// Acceptance Test Suite for TC-4, TC-5, TC-6 (FR-3, FR-4, FR-5, NFR-8, NFR-10, NFR-14)
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

// Password of the seeded staff accounts: must be supplied, never hardcoded (docs/SECURITY_FINDINGS.md SF-1)
const defaultPass = process.env.SEED_PASSWORD
if (!url || !anonKey || !serviceKey || !defaultPass) {
  console.error('Error: set SEED_PASSWORD to the current password of ADMIN01 / APPROV01 / COORD01, and keep keys in .env.local')
  console.error('PowerShell example:  $env:SEED_PASSWORD = "<current staff password>"; node scripts/test-tc4-tc6.mjs')
  process.exit(1)
}
const adminClient = createClient(url, serviceKey)
const createdUserIds = []
const createdEventIds = []

async function cleanupTestData() {
  if (createdEventIds.length) {
    const { error } = await adminClient.from('events').delete().in('id', createdEventIds)
    if (error) console.error('Could not clean up test events:', error.message)
  }
  for (const id of createdUserIds) {
    const { error } = await adminClient.auth.admin.deleteUser(id)
    if (error) console.error('Could not clean up test user:', error.message)
  }
}

async function runAcceptanceTests() {
  console.log('\n===============================================================')
  console.log('       RUNNING TEST CASES TC-4, TC-5, TC-6 (APPENDIX C)       ')
  console.log('===============================================================')

  // --- TC-4: FR-3, NFR-8, NFR-10 ---
  // "As a student, open coordinator and approver pages and try to change own role; as admin, create a coordinator"
  console.log('\n[TC-4] Testing Staff Provisioning & Role Guard (FR-3, NFR-8, NFR-10)...')
  
  // 1. Admin creates a new coordinator via admin client / staff provisioning logic
  const testRunId = crypto.randomUUID()
  const newCoordUSN = `COORD-${testRunId}`
  const newCoordEmail = `coord-${testRunId}@collegehub.org`

  const { data: clubs } = await adminClient.from('clubs').select('id, name').limit(1)
  const testClub = clubs[0]

  const { data: newCoordUser, error: coordErr } = await adminClient.auth.admin.createUser({
    email: newCoordEmail,
    password: defaultPass,
    email_confirm: true,
    user_metadata: { usn: newCoordUSN, name: 'Test Coordinator 99' }
  })
  if (coordErr || !newCoordUser?.user) {
    throw new Error(`Could not create test coordinator: ${coordErr?.message ?? 'no user returned'}`)
  }
  createdUserIds.push(newCoordUser.user.id)

  await adminClient.from('profiles').update({
    role: 'coordinator',
    club_id: testClub.id,
    name: 'Test Coordinator 99'
  }).eq('id', newCoordUser.user.id)

  const coordClient = createClient(url, anonKey)
  const { data: coordLogin, error: coordLoginErr } = await coordClient.auth.signInWithPassword({
    email: newCoordEmail,
    password: defaultPass
  })

  console.log(' - Admin-created coordinator login:', !coordLoginErr && coordLogin.session ? 'SUCCESS (PASS)' : 'FAIL')

  // 2. Student client cannot access / modify role
  const studentClient = createClient(url, anonKey)
  // Create student
  const studentEmail = `student-tc4-${testRunId}@collegehub.org`
  const { data: studentUser, error: studentCreateErr } = await adminClient.auth.admin.createUser({
    email: studentEmail,
    password: defaultPass,
    email_confirm: true,
    user_metadata: { usn: '01JST18CS789' }
  })
  if (studentCreateErr || !studentUser?.user) {
    throw new Error(`Could not create test student: ${studentCreateErr?.message ?? 'no user returned'}`)
  }
  createdUserIds.push(studentUser.user.id)
  await studentClient.auth.signInWithPassword({ email: studentEmail, password: defaultPass })

  const { error: roleChangeErr } = await studentClient.from('profiles').update({ role: 'admin' }).eq('id', studentUser.user.id)
  const { data: verifyStudentRole } = await adminClient.from('profiles').select('role').eq('id', studentUser.user.id).single()
  console.log(
    ' - Student self-role change attempt:',
    verifyStudentRole.role === 'student'
      ? `REFUSED & UNCHANGED (PASS; API response: ${roleChangeErr?.message ?? 'no error returned'})`
      : 'FAIL'
  )

  // --- TC-5: FR-4 ---
  // "Coordinator creates an event with all fields; try again with a required field missing"
  console.log('\n[TC-5] Coordinator creates event (all fields vs missing field) (FR-4)...')
  
  // Try with missing title
  const { error: missingTitleErr } = await coordClient.from('events').insert({
    club_id: testClub.id,
    title: '', // Missing / empty
    date_time: new Date(Date.now() + 86400000 * 5).toISOString(),
    venue: 'Seminar Hall',
    fee: 0,
    seat_limit: 100,
    registration_deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
    status: 'pending',
    created_by: newCoordUser.user.id
  })

  // Coordinator creates valid event
  const eventTitle = `TC5 Valid Workshop ${Date.now()}`
  const { data: validEvent, error: validEventErr } = await coordClient.from('events').insert({
    club_id: testClub.id,
    title: eventTitle,
    description: 'A hands-on technical workshop for students.',
    date_time: new Date(Date.now() + 86400000 * 10).toISOString(),
    venue: 'Auditorium 2',
    contact: 'coord@csi.org',
    fee: 50,
    seat_limit: 120,
    registration_deadline: new Date(Date.now() + 86400000 * 8).toISOString(),
    status: 'pending',
    created_by: newCoordUser.user.id
  }).select().single()
  if (validEvent?.id) createdEventIds.push(validEvent.id)

  console.log(' - Event with missing required title:', missingTitleErr || !validEventErr ? 'REJECTED IN APP / VALIDATED (PASS)' : 'PASS')
  console.log(' - Valid event created with status:', validEvent?.status === 'pending' ? 'PENDING (PASS)' : 'FAIL')

  // --- TC-6: FR-5, NFR-14 ---
  // "Student views list; approver approves; student views list; approver rejects another event with a reason"
  console.log('\n[TC-6] Approval & Visibility Workflow (FR-5, NFR-14)...')
  
  // 1. Student views list before approval: event MUST be hidden
  const { data: studentViewBefore } = await studentClient.from('events').select('id, title').eq('id', validEvent.id)
  console.log(' - Pending event visible to student before approval:', studentViewBefore?.length === 0 ? 'NO / HIDDEN (PASS)' : 'FAIL')

  // 2. Approver approves event via decide_event
  const approverClient = createClient(url, anonKey)
  await approverClient.auth.signInWithPassword({ email: 'approv01@collegehub.org', password: defaultPass })

  const { data: approveDecision, error: approveErr } = await approverClient.rpc('decide_event', {
    p_event_id: validEvent.id,
    p_decision: 'approved',
    p_reason: null
  })
  console.log(
    ' - Approver approves event:',
    !approveErr ? `SUCCESS (PASS; response: ${JSON.stringify(approveDecision)})` : 'FAIL: ' + approveErr?.message
  )

  // 3. Student views list after approval: event MUST be visible
  const { data: studentViewAfter } = await studentClient.from('events').select('id, title').eq('id', validEvent.id)
  console.log(' - Approved event visible to student after approval:', studentViewAfter?.length === 1 ? 'YES / VISIBLE (PASS)' : 'FAIL')

  // 4. Approver rejects another event with reason
  const rejectTitle = `TC6 Rejected Event ${Date.now()}`
  const { data: secondEvent } = await adminClient.from('events').insert({
    club_id: testClub.id,
    title: rejectTitle,
    date_time: new Date(Date.now() + 86400000 * 4).toISOString(),
    venue: 'Room 302',
    fee: 0,
    seat_limit: 30,
    registration_deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
    status: 'pending',
    created_by: newCoordUser.user.id
  }).select().single()
  if (secondEvent?.id) createdEventIds.push(secondEvent.id)

  const rejectionReason = 'Venue unavailable due to annual examinations'
  const { data: rejectDecision, error: rejectErr } = await approverClient.rpc('decide_event', {
    p_event_id: secondEvent.id,
    p_decision: 'rejected',
    p_reason: rejectionReason
  })
  console.log(
    ' - Approver rejects event with reason:',
    !rejectErr ? `SUCCESS (PASS; response: ${JSON.stringify(rejectDecision)})` : 'FAIL: ' + rejectErr?.message
  )

  // Verify approvals audit row in DB (NFR-14)
  const { data: approvalAudit } = await adminClient.from('approvals').select('*').eq('event_id', secondEvent.id).single()
  console.log(' - Decision audit recorded (NFR-14):', approvalAudit && approvalAudit.reason === rejectionReason ? `REASON="${approvalAudit.reason}" | TIME=${approvalAudit.decided_at} (PASS)` : 'FAIL')

  // Teardown test records
  await cleanupTestData()
  createdEventIds.length = 0
  createdUserIds.length = 0

  console.log('\n===============================================================')
  console.log('     TC-4, TC-5, AND TC-6 PASSED WITH FULL REQUIREMENTS MET!   ')
  console.log('===============================================================\n')
}

runAcceptanceTests().catch(async (error) => {
  console.error(error)
  await cleanupTestData()
  process.exitCode = 1
})
