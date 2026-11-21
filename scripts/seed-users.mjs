// Seed Staff Users Script (FR-3, NFR-8, NFR-10, TC-4)
// Provisions one Admin, one Approver, and one Coordinator (with club_id)
// Reads password from env or arguments - zero hardcoded secrets.

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Helper to load .env.local
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
const serviceKey = process.env.SUPABASE_SECRET_KEY
const seedPassword = process.env.SEED_PASSWORD || process.argv[2]

if (!url || !serviceKey) {
  console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

// No default password: a password committed to a public repo is a known credential (see docs/SECURITY_FINDINGS.md SF-1)
if (!seedPassword || seedPassword.length < 8) {
  console.error('Error: provide a staff password of at least 8 characters via SEED_PASSWORD (preferred) or as the first argument.')
  console.error('PowerShell example:  $env:SEED_PASSWORD = "<your password>"; node scripts/seed-users.mjs')
  console.error('Note: existing accounts keep their current password; this script only sets role and club for them.')
  process.exit(1)
}

async function seed() {
  const admin = createClient(url, serviceKey)
  console.log('\n================ SEED STAFF USERS (FR-3, NFR-10) ================')

  // 1. Fetch a club for coordinator assignment
  const { data: clubs, error: clubsErr } = await admin.from('clubs').select('id, name').limit(1)
  if (clubsErr || !clubs || clubs.length === 0) {
    console.error('Error fetching clubs for coordinator seeding:', clubsErr)
    return
  }
  const targetClub = clubs[0]
  console.log(`Assigning coordinator to club: "${targetClub.name}" (${targetClub.id})`)

  const staffUsers = [
    {
      usn: 'ADMIN01',
      name: 'System Admin',
      email: 'admin01@collegehub.org',
      role: 'admin',
      club_id: null,
    },
    {
      usn: 'APPROV01',
      name: 'Dr. Faculty Approver',
      email: 'approv01@collegehub.org',
      role: 'approver',
      club_id: null,
    },
    {
      usn: 'COORD01',
      name: 'CSI Student Coordinator',
      email: 'coord01@collegehub.org',
      role: 'coordinator',
      club_id: targetClub.id,
    },
  ]

  for (const staff of staffUsers) {
    console.log(`\nProvisioning ${staff.role.toUpperCase()} (${staff.usn})...`)

    // Check if user already exists
    const { data: userList } = await admin.auth.admin.listUsers()
    const existingUser = userList?.users?.find((u) => u.email === staff.email)

    let userId = existingUser?.id

    if (!existingUser) {
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: staff.email,
        password: seedPassword,
        email_confirm: true,
        user_metadata: {
          usn: staff.usn,
          name: staff.name,
        },
      })

      if (createErr) {
        console.error(` - Error creating auth user for ${staff.usn}:`, createErr.message)
        continue
      }
      userId = newUser.user?.id
      console.log(` - Auth user created with ID: ${userId}`)
    } else {
      console.log(` - Existing auth user found with ID: ${userId}`)
    }

    // Set role and club_id explicitly on profiles row using admin client
    const { error: profileErr } = await admin
      .from('profiles')
      .update({
        role: staff.role,
        club_id: staff.club_id,
        name: staff.name,
      })
      .eq('id', userId)

    if (profileErr) {
      console.error(` - Error assigning role to ${staff.usn}:`, profileErr.message)
    } else {
      console.log(` - Profile updated: role="${staff.role}", club_id="${staff.club_id || 'N/A'}" (SUCCESS)`)
    }
  }

  console.log('\n================ STAFF SEEDING COMPLETED ================')
}

seed().catch(console.error)
