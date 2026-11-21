// Security Penetration Check Script (FR-3, NFR-7, NFR-8, NFR-14)
// Evaluates 10 security checks from a normal student / logged-out context:
// (a) Updating own role to admin
// (b) Inserting into registrations directly
// (c) Reading another user's profile
// (d) Reading a Pending event
// (e) Injecting role/club_id via public auth.signUp
// (f) Reading another user's alerts and certificates
// (g) Inserting into events directly
// (h) Calling decide_event RPC
// (i) Calling decide_event while logged out (anon role)
// (j) Editing an alert's content (only the is_read flag may change)
//
// Prerequisites: scripts/seed-users.mjs has been run (ADMIN01 must exist) and
// supabase/migrations/authorization_and_alert_hardening.sql has been applied (needed for checks i and j).
// NOTE: runs against the project in .env.local and creates/removes throwaway rows.
//
// In every case, authoritative state is re-read using the admin client to verify
// that no modification occurred (preventing silent 0-row RLS update false-passes).

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim()
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const serviceKey = process.env.SUPABASE_SECRET_KEY

if (!url || !anonKey || !serviceKey) {
  console.error('Error: Missing required keys in .env.local')
  process.exit(1)
}

const adminClient = createClient(url, serviceKey)
const studentClient = createClient(url, anonKey)

// A client that never signs in = a logged-out visitor (also keeps signUp attempts away from studentClient's session)
const freshAnon = () =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

const ROGUE_EVENT_TITLE = `Rogue Student Event ${crypto.randomUUID()}`

// Everything this script creates is tracked here so teardown removes ONLY those rows
let studentId = null
let pendingEventId = null
let throwawayUserId = null
let rogueEventId = null
const createdAlertIds = []

async function cleanup() {
  if (pendingEventId) await adminClient.from('events').delete().eq('id', pendingEventId)
  if (rogueEventId) await adminClient.from('events').delete().eq('id', rogueEventId)
  if (createdAlertIds.length) await adminClient.from('alerts').delete().in('id', createdAlertIds)
  if (studentId) await adminClient.auth.admin.deleteUser(studentId)
  if (throwawayUserId) await adminClient.auth.admin.deleteUser(throwawayUserId)
}

function abort(message) {
  console.error(message)
  process.exitCode = 1 // an aborted run must never look like a pass
}

async function runSecurityCheck() {
  console.log('\n===============================================================')
  console.log('       SECURITY & RLS PENETRATION SUITE (PART B.4 & ADDITIONS)  ')
  console.log('===============================================================')

  const { data: users } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingEmails = new Set((users?.users ?? []).map((user) => user.email?.toLowerCase()))
  function createUniqueTestUSN() {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const suffix = String(crypto.randomInt(0, 1000)).padStart(3, '0')
      const candidate = `01JST18CS${suffix}`
      if (!existingEmails.has(`${candidate.toLowerCase()}@collegehub.org`)) {
        existingEmails.add(`${candidate.toLowerCase()}@collegehub.org`)
        return candidate
      }
    }
    throw new Error('Could not generate an unused test USN.')
  }

  const studentUSN = createUniqueTestUSN()
  const studentEmail = `${studentUSN.toLowerCase()}@collegehub.org`
  const studentPassword = 'StudentPass123!'

  // 1. Setup Student Test Account
  const { data: createdStudent, error: createStudentErr } =
    await adminClient.auth.admin.createUser({
      email: studentEmail,
      password: studentPassword,
      email_confirm: true,
      user_metadata: { usn: studentUSN, name: 'Normal Student' },
    })

  if (createStudentErr) {
    return abort(`Failed to provision student test account: ${createStudentErr.message}`)
  }
  studentId = createdStudent.user.id

  // Authenticate student client to get user session JWT
  const { data: authData, error: authErr } = await studentClient.auth.signInWithPassword({
    email: studentEmail,
    password: studentPassword,
  })

  if (authErr || !authData.session) {
    await cleanup()
    return abort(`Failed to authenticate student client: ${authErr?.message}`)
  }
  console.log(`Authenticated as student: ${studentUSN} (${studentId})`)

  // 2. Fetch or create a target staff user for privacy attack tests
  const adminUser = users?.users?.find((u) => u.email === 'admin01@collegehub.org')
  if (!adminUser) {
    await cleanup()
    return abort('ADMIN01 not found. Run `node scripts/seed-users.mjs` first: the privacy checks need a real staff account as the target.')
  }
  const targetStaffId = adminUser.id

  // 3. Setup a target pending event for access-control tests
  const { data: clubs } = await adminClient.from('clubs').select('id').limit(1)
  if (!clubs || clubs.length === 0) {
    await cleanup()
    return abort('No clubs found. Run supabase/seed.sql first.')
  }
  const clubId = clubs[0].id

  const { data: pendingEvent, error: pendingEventErr } = await adminClient
    .from('events')
    .insert({
      club_id: clubId,
      title: 'Secret Pending Hackathon',
      date_time: new Date(Date.now() + 86400000 * 7).toISOString(),
      venue: 'Auditorium 1',
      fee: 0,
      seat_limit: 100,
      registration_deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
      status: 'pending',
      created_by: targetStaffId,
    })
    .select()
    .single()

  if (pendingEventErr) {
    await cleanup()
    return abort(`Failed to create test pending event: ${pendingEventErr.message}`)
  }
  pendingEventId = pendingEvent.id

  let totalTests = 0
  let passedTests = 0

  function recordResult(testName, isPassed, details) {
    totalTests++
    if (isPassed) {
      passedTests++
      console.log(`[PASS] ${testName}`)
      if (details) console.log(`       Reason: ${details}`)
    } else {
      console.log(`[FAIL] ${testName}`)
      if (details) console.log(`       Error: ${details}`)
    }
  }

  // --- Attack (a): Updating own role to admin ---
  console.log('\n--- (a) Testing Privilege Escalation (Updating own role to admin) ---')
  const { data: updateData, error: updateErr } = await studentClient
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', studentId)

  // Re-read with adminClient to confirm role remains 'student'
  const { data: adminCheckA } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', studentId)
    .single()

  const passedA = adminCheckA.role === 'student'
  recordResult(
    'Privilege Escalation Blocked',
    passedA,
    `Attacked response: ${updateErr ? updateErr.message : 'no error returned'}; response rows: ${updateData?.length ?? 0}. Authoritative DB role: "${adminCheckA.role}"`
  )

  // --- Attack (b): Direct insertion into registrations ---
  console.log('\n--- (b) Testing Direct Registrations Insert ---')
  const { data: insertRegData, error: insertRegErr } = await studentClient
    .from('registrations')
    .insert({
      event_id: pendingEvent.id,
      student_id: studentId,
      status: 'confirmed',
    })

  const { data: adminCheckB } = await adminClient
    .from('registrations')
    .select('id')
    .eq('student_id', studentId)

  const passedB = !!insertRegErr && adminCheckB.length === 0
  recordResult(
    'Direct Registrations Insert Blocked',
    passedB,
    `Error returned: "${insertRegErr?.message}". Response rows: ${insertRegData?.length ?? 0}; registrations in DB: ${adminCheckB.length}`
  )

  // --- Attack (c): Reading another user\'s profile ---
  console.log('\n--- (c) Testing Reading Another User\'s Profile ---')
  const { data: readOtherProfile, error: readOtherErr } = await studentClient
    .from('profiles')
    .select('id, usn, role')
    .eq('id', targetStaffId)

  const passedC = !readOtherErr && (!readOtherProfile || readOtherProfile.length === 0)
  recordResult(
    'Another User Profile Leakage Blocked',
    passedC,
    `Rows returned: ${readOtherProfile ? readOtherProfile.length : 0}${readOtherErr ? `; query error: ${readOtherErr.message}` : ''}`
  )

  // --- Attack (d): Reading a Pending event ---
  console.log('\n--- (d) Testing Reading a Pending Event ---')
  const { data: readPendingData, error: readPendingErr } = await studentClient
    .from('events')
    .select('id, title, status')
    .eq('id', pendingEvent.id)

  const passedD = !readPendingErr && (!readPendingData || readPendingData.length === 0)
  recordResult(
    'Pending Event Leakage Blocked',
    passedD,
    `Rows returned to student: ${readPendingData ? readPendingData.length : 0}${readPendingErr ? `; query error: ${readPendingErr.message}` : ''}`
  )

  // --- Attack (e): auth.signUp role/club metadata injection ---
  console.log('\n--- (e) Testing Metadata Injection via public auth.signUp ---')
  const throwawayUSN = createUniqueTestUSN()
  const throwawayEmail = `${throwawayUSN.toLowerCase()}@collegehub.org`

  // Attacker calls public signUp injecting role: 'admin' and club_id: clubId
  const { data: signUpAttack, error: signUpAttackErr } = await freshAnon().auth.signUp({
    email: throwawayEmail,
    password: 'MaliciousPass123!',
    options: {
      data: {
        role: 'admin',
        club_id: clubId,
      },
    },
  })

  let passedE = false
  let detailE = ''

  if (signUpAttackErr) {
    passedE = true
    detailE = `Public signup rejected: ${signUpAttackErr.message}`
  } else if (signUpAttack?.user?.id) {
    throwawayUserId = signUpAttack.user.id
    const { data: profileE } = await adminClient
      .from('profiles')
      .select('role, club_id')
      .eq('id', signUpAttack.user.id)
      .single()

    passedE = profileE?.role === 'student' && profileE?.club_id === null
    detailE = `Profile created with: role="${profileE?.role}", club_id=${profileE?.club_id}`
    await adminClient.auth.admin.deleteUser(throwawayUserId)
    throwawayUserId = null
  } else {
    passedE = true
    detailE = 'Public signup disabled or returned no user'
  }
  recordResult('Metadata Injection Blocked', passedE, detailE)

  // --- Attack (f): Reading another user\'s alerts and certificates ---
  console.log('\n--- (f) Testing Reading Another User\'s Alerts & Certificates ---')
  // Create dummy alert for target staff
  const { data: staffAlert } = await adminClient
    .from('alerts')
    .insert({ user_id: targetStaffId, message: 'Staff confidential notice' })
    .select('id')
    .single()
  if (staffAlert) createdAlertIds.push(staffAlert.id)

  const { data: alertLeak } = await studentClient
    .from('alerts')
    .select('*')
    .eq('user_id', targetStaffId)

  const { data: certLeak } = await studentClient
    .from('certificates')
    .select('*')
    .eq('student_id', targetStaffId)

  const passedF = !!staffAlert && (!alertLeak || alertLeak.length === 0) && (!certLeak || certLeak.length === 0)
  recordResult(
    'Alerts & Certificates Leakage Blocked',
    passedF,
    `Alerts returned: ${alertLeak?.length || 0}, Certificates returned: ${certLeak?.length || 0}`
  )

  // --- Attack (g): Direct insert into events as student ---
  console.log('\n--- (g) Testing Direct Events Insert as Student ---')
  const maliciousTitle = ROGUE_EVENT_TITLE
  const { data: rogueEvent, error: rogueEventErr } = await studentClient
    .from('events')
    .insert({
      club_id: clubId,
      title: maliciousTitle,
      date_time: new Date(Date.now() + 86400000 * 3).toISOString(),
      venue: 'Classroom 101',
      fee: 0,
      seat_limit: 50,
      registration_deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
      status: 'pending',
      created_by: studentId,
    })
    .select('id')
    .maybeSingle()

  const { data: checkG, error: checkGErr } = await adminClient
    .from('events')
    .select('id')
    .eq('title', maliciousTitle)
  rogueEventId = rogueEvent?.id ?? checkG?.[0]?.id ?? null

  const passedG = !checkGErr && !!rogueEventErr && !rogueEvent && (checkG?.length ?? 0) === 0
  recordResult(
    'Student Event Creation Blocked by RLS',
    passedG,
    `Insert error: "${rogueEventErr?.message}". Insert response: ${rogueEvent?.id ?? 'no row'}; rows created in DB: ${checkG?.length ?? 0}${checkGErr ? `; verification error: ${checkGErr.message}` : ''}`
  )

  // --- Attack (h): Calling decide_event RPC as student ---
  console.log('\n--- (h) Testing decide_event RPC Execution by Student ---')
  const { data: rpcData, error: rpcErr } = await studentClient.rpc('decide_event', {
    p_event_id: pendingEvent.id,
    p_decision: 'approved',
    p_reason: null,
  })

  // Authoritatively verify pendingEvent status in DB
  const { data: checkH } = await adminClient
    .from('events')
    .select('status')
    .eq('id', pendingEvent.id)
    .single()

  const passedH = !!rpcErr && !rpcData && checkH.status === 'pending'
  recordResult(
    'Unauthorized decide_event Refused',
    passedH,
    `RPC Error: "${rpcErr?.message}". Authoritative event status: "${checkH.status}"`
  )

  // --- Check (i): decide_event while logged out ---
  console.log('\n--- (i) Testing decide_event RPC Execution by a Logged-out Visitor ---')
  const { error: anonRpcErr } = await freshAnon().rpc('decide_event', {
    p_event_id: pendingEvent.id,
    p_decision: 'approved',
    p_reason: null,
  })

  const { data: checkI } = await adminClient
    .from('events')
    .select('status')
    .eq('id', pendingEvent.id)
    .single()

  const passedI = !!anonRpcErr && checkI.status === 'pending'
  recordResult(
    'Logged-out decide_event Refused',
    passedI,
    `RPC Error: "${anonRpcErr?.message}". Authoritative event status: "${checkI.status}"`
  )

  // --- Check (j): a student may only flip is_read on their own alerts ---
  console.log('\n--- (j) Testing Alert Tampering (only is_read may change) ---')
  const { data: ownAlert } = await adminClient
    .from('alerts')
    .insert({ user_id: studentId, message: 'Original alert text' })
    .select('id')
    .single()
  if (ownAlert) createdAlertIds.push(ownAlert.id)
  const alertId = ownAlert?.id ?? '00000000-0000-0000-0000-000000000000'

  await studentClient.from('alerts').update({ message: 'Tampered by student' }).eq('id', alertId)
  const { data: afterTamper } = await adminClient
    .from('alerts')
    .select('message')
    .eq('id', alertId)
    .single()

  recordResult(
    'Alert Content Tampering Blocked',
    !!ownAlert && afterTamper?.message === 'Original alert text',
    `Authoritative message: "${afterTamper?.message}" (needs supabase/migrations/authorization_and_alert_hardening.sql)`
  )

  await studentClient.from('alerts').update({ is_read: true }).eq('id', alertId)
  const { data: afterRead } = await adminClient
    .from('alerts')
    .select('is_read')
    .eq('id', alertId)
    .single()

  recordResult(
    'Student Can Still Mark Own Alert As Read',
    afterRead?.is_read === true,
    `is_read = ${afterRead?.is_read}`
  )

  // 4. Teardown: removes only the rows this script created
  await cleanup()

  console.log('\n===============================================================')
  console.log(`  SECURITY TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`)
  console.log('===============================================================\n')

  if (passedTests === totalTests) {
    console.log(`All ${totalTests} security checks passed. (NFR-7, NFR-8, NFR-14)`)
  } else {
    console.error('One or more security checks failed.')
    process.exit(1)
  }
}

runSecurityCheck().catch(async (err) => {
  console.error(err)
  await cleanup().catch(() => {})
  process.exit(1)
})
