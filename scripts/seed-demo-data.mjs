// Demo data: approved sample events for demos and the performance test (TC-23)
//
// Usage:  node scripts/seed-demo-data.mjs [--count 8]     create sample events (default 8)
//         node scripts/seed-demo-data.mjs --count 100      100 events for the load-time test
//         node scripts/seed-demo-data.mjs --clean          remove every "[DEMO]" event
//
// Needs at least one club (supabase/seed.sql) and one coordinator or admin (scripts/seed-users.mjs).
// Events are inserted as already approved, with dates in the next weeks. Removing them also
// removes their registrations.

import { createClient } from '@supabase/supabase-js'
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SECRET_KEY
if (!url || !serviceKey) {
  console.error('Error: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const PREFIX = '[DEMO] '

const countIndex = process.argv.indexOf('--count')
const count = countIndex !== -1 ? Number(process.argv[countIndex + 1]) : 8

const TOPICS = ['Workshop', 'Hackathon', 'Guest Lecture', 'Quiz Night', 'Open Mic', 'Coding Contest', 'Photo Walk', 'Career Talk']
const DAY = 24 * 60 * 60 * 1000

async function clean() {
  const { data, error } = await admin.from('events').delete().like('title', `${PREFIX}%`).select('id')
  if (error) throw new Error(error.message)
  console.log(`Removed ${data.length} demo event(s).`)
}

async function seed() {
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    throw new Error('--count must be a whole number between 1 and 500.')
  }

  const { data: clubs, error: clubError } = await admin.from('clubs').select('id, name').order('name')
  if (clubError || !clubs?.length) throw new Error('No clubs found. Run supabase/seed.sql first.')

  const { data: creator } = await admin.from('profiles').select('id').in('role', ['coordinator', 'admin']).limit(1).single()
  if (!creator) throw new Error('No coordinator or admin found. Run scripts/seed-users.mjs first.')

  // 10:00 IST = 04:30 UTC, starting two days from now so the registration window is open
  const firstDay = new Date()
  firstDay.setUTCHours(4, 30, 0, 0)

  const rows = Array.from({ length: count }, (_, i) => {
    const club = clubs[i % clubs.length]
    const start = new Date(firstDay.getTime() + (2 + i) * DAY)
    return {
      club_id: club.id,
      title: `${PREFIX}${club.name} ${TOPICS[i % TOPICS.length]} ${i + 1}`,
      description: `Sample event ${i + 1} created by scripts/seed-demo-data.mjs for demos and testing.`,
      date_time: start.toISOString(),
      venue: ['Main Auditorium', 'Seminar Hall', 'Lab 3', 'Open Air Theatre'][i % 4],
      contact: 'demo@example.com',
      fee: i % 3 === 0 ? 0 : 50,
      seat_limit: 20 + (i % 5) * 20,
      registration_deadline: new Date(start.getTime() - DAY).toISOString(),
      status: 'approved',
      created_by: creator.id,
    }
  })

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await admin.from('events').insert(rows.slice(i, i + 100))
    if (error) throw new Error(error.message)
  }
  console.log(`Created ${rows.length} approved demo event(s). Remove them with: node scripts/seed-demo-data.mjs --clean`)
}

;(process.argv.includes('--clean') ? clean() : seed()).catch((error) => {
  console.error(`Error: ${error.message}`)
  process.exit(1)
})
