import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const STAFF_ACCOUNTS = [
  { usn: 'ADMIN01', email: 'admin01@collegehub.org', role: 'admin' },
  { usn: 'APPROV01', email: 'approv01@collegehub.org', role: 'approver' },
  { usn: 'COORD01', email: 'coord01@collegehub.org', role: 'coordinator' },
]

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

async function findUsersByEmail(admin) {
  const usersByEmail = new Map()

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Could not verify staff accounts: ${error.message}`)

    for (const user of data.users) {
      if (user.email) usersByEmail.set(user.email.toLowerCase(), user)
    }
    if (data.users.length < 1000) return usersByEmail
  }

  throw new Error('Too many auth users to safely verify the staff accounts.')
}

async function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has('--help')) {
    console.log('Usage: npm run reset:staff-passwords -- --confirm-remote')
    console.log('Set distinct ADMIN01_PASSWORD, APPROV01_PASSWORD, and COORD01_PASSWORD values (12+ characters).')
    return
  }

  for (const arg of args) {
    if (arg !== '--confirm-remote') throw new Error(`Unknown option: ${arg}`)
  }

  const passwords = new Map(
    STAFF_ACCOUNTS.map((account) => [account.usn, process.env[`${account.usn}_PASSWORD`]])
  )
  for (const account of STAFF_ACCOUNTS) {
    const password = passwords.get(account.usn)
    if (!password || password.length < 12) {
      throw new Error(`Set ${account.usn}_PASSWORD to a password of at least 12 characters.`)
    }
  }
  if (new Set(passwords.values()).size !== STAFF_ACCOUNTS.length) {
    throw new Error('Choose a different password for each staff account.')
  }

  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.')
  }

  const hostname = new URL(url).hostname
  const isLocal = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.localhost')
  if (!isLocal && !args.has('--confirm-remote')) {
    throw new Error('The configured Supabase project is remote. Review it, then rerun with --confirm-remote.')
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const usersByEmail = await findUsersByEmail(admin)
  const verifiedAccounts = []

  for (const account of STAFF_ACCOUNTS) {
    const user = usersByEmail.get(account.email)
    if (!user) throw new Error(`${account.usn} was not found in Supabase Auth. No passwords were changed.`)

    const { data: profile, error } = await admin
      .from('profiles')
      .select('usn, role')
      .eq('id', user.id)
      .maybeSingle()
    if (error) throw new Error(`Could not verify ${account.usn}: ${error.message}`)
    if (!profile || profile.usn !== account.usn || profile.role !== account.role) {
      throw new Error(`${account.usn} does not have the expected staff profile. No passwords were changed.`)
    }

    verifiedAccounts.push({ ...account, id: user.id })
  }

  for (const account of verifiedAccounts) {
    const { error } = await admin.auth.admin.updateUserById(account.id, {
      password: passwords.get(account.usn),
    })
    if (error) {
      throw new Error(`Could not reset ${account.usn}: ${error.message}. Earlier accounts in this run may already be reset.`)
    }
    console.log(`Password reset for ${account.usn} (${account.role}).`)
  }

  console.log('All three staff passwords were reset. Password values were not printed or saved by this script.')
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
