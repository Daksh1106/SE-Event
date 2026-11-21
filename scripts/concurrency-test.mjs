// Concurrency test (NFR-5, TC-14): many students try to take the last seat at the same moment.
//
// Usage:  node scripts/concurrency-test.mjs [--students 20] [--seats 1]
//
// What it does: creates throwaway students and one approved event with the given number of seats,
// signs every student in, then fires all registrations at the same instant. Expected result:
// exactly `seats` Confirmed, everybody else Waitlisted with unique positions 1, 2, 3...
// Everything it creates is removed again, also when the test fails.
//
// Note: Supabase rate-limits password sign-ins (about 30 per 5 minutes per IP), so keep
// --students at 25 or fewer. The 200-registration capacity check (TC-15) was run directly against
// the database functions and does not need sign-ins.

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim()
  }
}
loadEnv()

function argValue(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index !== -1 && process.argv[index + 1] ? Number(process.argv[index + 1]) : fallback
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const serviceKey = process.env.SUPABASE_SECRET_KEY
if (!url || !anonKey || !serviceKey) {
  console.error('Error: missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const studentCount = argValue('students', 20)
const seats = argValue('seats', 1)
if (!Number.isInteger(studentCount) || !Number.isInteger(seats) || seats < 1 || studentCount <= seats) {
  console.error('Error: --students must be a whole number greater than --seats (and --seats at least 1).')
  process.exit(1)
}
if (studentCount > 28) {
  console.error('Error: keep --students at 28 or fewer (Supabase sign-in rate limit).')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const TITLE = `ZZ CONCURRENCY TEST ${crypto.randomUUID()}`
let eventId = null
const userIds = []

async function cleanup() {
  if (eventId) await admin.from('events').delete().eq('id', eventId)
  else await admin.from('events').delete().eq('title', TITLE)
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id)
  }
}

async function run() {
  console.log(`Race: ${studentCount} students, ${seats} seat(s)\n`)

  const { data: club } = await admin.from('clubs').select('id').limit(1).single()
  const { data: creator } = await admin.from('profiles').select('id').in('role', ['coordinator', 'admin']).limit(1).single()
  if (!club || !creator) throw new Error('Needs at least one club and one coordinator/admin (run supabase/seed.sql and scripts/seed-users.mjs).')

  const day = 24 * 60 * 60 * 1000
  const { data: event, error: eventError } = await admin
    .from('events')
    .insert({
      club_id: club.id,
      title: TITLE,
      description: 'Temporary event created by scripts/concurrency-test.mjs',
      date_time: new Date(Date.now() + 3 * day).toISOString(),
      venue: 'Test hall',
      fee: 0,
      seat_limit: seats,
      registration_deadline: new Date(Date.now() + 2 * day).toISOString(),
      status: 'approved',
      created_by: creator.id,
    })
    .select('id')
    .single()
  if (eventError) throw new Error(`Could not create the test event: ${eventError.message}`)
  eventId = event.id

  // Throwaway students, each with their own signed-in client
  const clients = []
  for (let i = 1; i <= studentCount; i++) {
    const email = `zzct-${crypto.randomUUID()}-${String(i).padStart(3, '0')}@collegehub.org`
    const password = `${crypto.randomBytes(12).toString('base64url')}Aa1`
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw new Error(`Could not create ${email}: ${error.message}`)
    userIds.push(data.user.id)

    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) throw new Error(`Could not sign in ${email}: ${signInError.message}`)
    clients.push(client)
  }
  console.log(`${studentCount} students signed in. Starting the race...`)

  // THE RACE: every registration is sent at the same moment
  const started = Date.now()
  const outcomes = await Promise.all(clients.map((client) => client.rpc('register_for_event', { p_event_id: eventId })))
  console.log(`All ${studentCount} requests finished in ${Date.now() - started} ms\n`)

  const errors = outcomes.filter((o) => o.error)
  const results = outcomes.filter((o) => !o.error).map((o) => o.data)
  const confirmed = results.filter((r) => r.status === 'confirmed')
  const waitlisted = results.filter((r) => r.status === 'waitlisted')
  const positions = waitlisted.map((r) => r.position).sort((a, b) => a - b)

  // Authoritative check straight from the database
  const { data: rows } = await admin.from('registrations').select('status').eq('event_id', eventId)
  const dbConfirmed = rows.filter((r) => r.status === 'confirmed').length
  const dbWaitlisted = rows.filter((r) => r.status === 'waitlisted').length

  const expectedPositions = Array.from({ length: studentCount - seats }, (_, i) => i + 1)
  const checks = [
    ['no request failed', errors.length === 0, errors.map((e) => e.error.message).join('; ')],
    [`exactly ${seats} Confirmed`, confirmed.length === seats && dbConfirmed === seats, `answers: ${confirmed.length}, database: ${dbConfirmed}`],
    [`${studentCount - seats} Waitlisted`, waitlisted.length === studentCount - seats && dbWaitlisted === studentCount - seats, `answers: ${waitlisted.length}, database: ${dbWaitlisted}`],
    ['waitlist positions are unique 1..N', JSON.stringify(positions) === JSON.stringify(expectedPositions), `got ${positions.join(',')}`],
  ]

  let failed = 0
  for (const [name, ok, detail] of checks) {
    if (!ok) failed += 1
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`)
  }
  console.log(failed === 0 ? '\nTC-14 passed: the seat limit held under simultaneous registration.' : `\n${failed} check(s) failed.`)
  if (failed > 0) process.exitCode = 1
}

run()
  .catch((error) => {
    console.error(`\nTest aborted: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup().catch(() => {})
    console.log('Test data removed.')
  })
