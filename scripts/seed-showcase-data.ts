import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { formatISTDate } from '../lib/datetime'
import { buildCertificatePdf } from '../lib/pdf/certificate-pdf'
import type { Database } from '../types/database'

type AdminClient = SupabaseClient<Database>

const PREFIX = '[SHOWCASE] '
const DAY_MS = 24 * 60 * 60 * 1000
const CERTIFICATE_BUCKET = 'certificates'
const DEMO_ACCOUNTS = [
  {
    key: 'studentOne',
    usn: 'SHOWCASE01',
    name: 'Ananya Showcase',
    role: 'student',
    clubId: null,
  },
  {
    key: 'studentTwo',
    usn: 'SHOWCASE02',
    name: 'Rohan Showcase',
    role: 'student',
    clubId: null,
  },
] as const

const EVENTS = [
  {
    key: 'fossCamp',
    clubName: 'Linux Campus Club (LCC-JSSSTU)',
    title: `${PREFIX}FOSSCAMP`,
    daysFromToday: 14,
    seatLimit: 5,
    status: 'approved',
    venue: 'Demo Venue — confirm before publishing',
  },
  {
    key: 'fossBytes',
    clubName: 'Linux Campus Club (LCC-JSSSTU)',
    title: `${PREFIX}FOSSBYTES`,
    daysFromToday: -14,
    seatLimit: 30,
    status: 'approved',
    venue: 'Demo Venue — confirm before publishing',
  },
  {
    key: 'enigma',
    clubName: 'Computer Society Of India (CSI-JSSSTU)',
    title: `${PREFIX}ENIGMA`,
    daysFromToday: 10,
    seatLimit: 1,
    status: 'approved',
    venue: 'Demo Venue — confirm before publishing',
  },
  {
    key: 'technologix',
    clubName: 'Computer Society Of India (CSI-JSSSTU)',
    title: `${PREFIX}TECHNOLOGIX`,
    daysFromToday: -7,
    seatLimit: 30,
    status: 'approved',
    venue: 'Demo Venue — confirm before publishing',
  },
  {
    key: 'electroVaganza',
    clubName: 'TESLA-SJCE',
    title: `${PREFIX}Electro Vaganza`,
    daysFromToday: 21,
    seatLimit: 20,
    status: 'approved',
    venue: 'Demo Venue — confirm before publishing',
  },
  {
    key: 'convivial',
    clubName: 'IIC- JSSSTU',
    title: `${PREFIX}Convivial`,
    daysFromToday: 28,
    seatLimit: 20,
    status: 'approved',
    venue: 'Demo Venue — confirm before publishing',
  },
  {
    key: 'adventureJunkyard',
    clubName: 'Sahas Adventure Club',
    title: `${PREFIX}Adventure Junkyard`,
    daysFromToday: 35,
    seatLimit: 1,
    status: 'approved',
    venue: 'Demo Venue — confirm before publishing',
  },
  {
    key: 'aeroWorkshop',
    clubName: 'Team AeroJC',
    title: `${PREFIX}Aeromodelling Workshop`,
    daysFromToday: 42,
    seatLimit: 25,
    status: 'approved',
    venue: 'Demo Venue — confirm before publishing',
  },
  {
    key: 'lccProposal',
    clubName: 'Linux Campus Club (LCC-JSSSTU)',
    title: `${PREFIX}LCC Technical Workshop Proposal`,
    daysFromToday: 49,
    seatLimit: 40,
    status: 'pending',
    venue: 'Demo Venue — confirm before publishing',
  },
] as const

const REGISTRATIONS = [
  { eventKey: 'fossCamp', studentKey: 'studentOne', status: 'confirmed' },
  { eventKey: 'fossCamp', studentKey: 'studentTwo', status: 'confirmed' },
  { eventKey: 'fossBytes', studentKey: 'studentOne', status: 'attended' },
  { eventKey: 'enigma', studentKey: 'studentOne', status: 'confirmed' },
  { eventKey: 'enigma', studentKey: 'studentTwo', status: 'waitlisted' },
  { eventKey: 'technologix', studentKey: 'studentTwo', status: 'attended' },
  { eventKey: 'electroVaganza', studentKey: 'studentOne', status: 'confirmed' },
  { eventKey: 'convivial', studentKey: 'studentTwo', status: 'confirmed' },
  { eventKey: 'adventureJunkyard', studentKey: 'studentTwo', status: 'confirmed' },
  { eventKey: 'adventureJunkyard', studentKey: 'studentOne', status: 'waitlisted' },
] as const

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

function eventDate(daysFromToday: number): Date {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysFromToday)
  date.setUTCHours(4, 30, 0, 0)
  return date
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function findAuthUserByEmail(
  admin: AdminClient,
  email: string
) {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Could not check demo accounts: ${error.message}`)
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase())
    if (user) return user
    if (data.users.length < 1000) return null
  }

  throw new Error('Too many auth users to safely locate the showcase accounts.')
}

async function ensureDemoStudent(
  admin: AdminClient,
  account: (typeof DEMO_ACCOUNTS)[number],
  password: string
) {
  const email = `${account.usn.toLowerCase()}@collegehub.org`
  const existingUser = await findAuthUserByEmail(admin, email)
  let userId: string

  if (existingUser) {
    if (existingUser.user_metadata?.showcase_demo !== true) {
      throw new Error(
        `The account ${account.usn} already exists but is not marked as a showcase account. It was left unchanged.`
      )
    }
    userId = existingUser.id
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        usn: account.usn,
        name: account.name,
        showcase_demo: true,
      },
    })
    if (error || !data.user) {
      throw new Error(`Could not create ${account.usn}: ${error?.message ?? 'no user returned'}`)
    }
    userId = data.user.id
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, usn, name, role')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw new Error(`Could not verify ${account.usn}: ${profileError.message}`)

  if (profile) {
    if (profile.usn !== account.usn || profile.role !== 'student') {
      throw new Error(`The profile for ${account.usn} does not match the expected demo student. It was left unchanged.`)
    }
  } else {
    const { error: insertError } = await admin.from('profiles').insert({
      id: userId,
      usn: account.usn,
      name: account.name,
      role: 'student',
      club_id: null,
    })
    if (insertError) {
      throw new Error(`Could not create the ${account.usn} profile: ${insertError.message}`)
    }
  }

  if (existingUser) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password })
    if (passwordError) {
      throw new Error(`Could not update the password for ${account.usn}: ${passwordError.message}`)
    }
  }

  return { id: userId, usn: account.usn, name: profile?.name || account.name }
}

async function removeShowcaseData(admin: AdminClient) {
  const { data: rows, error } = await admin
    .from('events')
    .select('id')
    .like('title', `${PREFIX}%`)
  if (error) throw new Error(`Could not find showcase events: ${error.message}`)

  const eventIds = (rows ?? []).map((row) => row.id)
  if (eventIds.length === 0) {
    console.log('No showcase events found.')
    return
  }

  const { data: certificates, error: certificateError } = await admin
    .from('certificates')
    .select('file_path')
    .in('event_id', eventIds)
  if (certificateError) {
    throw new Error(`Could not find showcase certificate files: ${certificateError.message}`)
  }

  const paths = (certificates ?? []).map((certificate) => certificate.file_path)
  if (paths.length > 0) {
    const { error: storageError } = await admin.storage
      .from(CERTIFICATE_BUCKET)
      .remove(paths)
    if (storageError) throw new Error(`Could not remove showcase certificates: ${storageError.message}`)
  }

  const { data: removed, error: deleteError } = await admin
    .from('events')
    .delete()
    .in('id', eventIds)
    .select('id')
  if (deleteError) throw new Error(`Could not remove showcase events: ${deleteError.message}`)

  console.log(`Removed ${removed?.length ?? 0} showcase event(s), their registrations, alerts, and certificates.`)
  console.log('The two showcase student auth accounts are kept so they can be reused.')
}

async function rollbackSeed(
  admin: AdminClient,
  eventIds: string[],
  uploadedPaths: string[]
) {
  if (uploadedPaths.length > 0) {
    const { error } = await admin.storage.from(CERTIFICATE_BUCKET).remove(uploadedPaths)
    if (error) console.error(`Rollback could not remove certificate files: ${error.message}`)
  }
  if (eventIds.length > 0) {
    const { error } = await admin.from('events').delete().in('id', eventIds)
    if (error) console.error(`Rollback could not remove showcase events: ${error.message}`)
  }
}

async function seed(admin: AdminClient, password: string) {
  const { data: existingEvents, error: existingError } = await admin
    .from('events')
    .select('id')
    .like('title', `${PREFIX}%`)
    .limit(1)
  if (existingError) throw new Error(`Could not check existing showcase events: ${existingError.message}`)
  if (existingEvents?.length) {
    throw new Error('Showcase data already exists. Run with --clean before seeding it again.')
  }

  const clubNames = [...new Set(EVENTS.map((event) => event.clubName))]
  const { data: clubs, error: clubsError } = await admin
    .from('clubs')
    .select('id, name, is_active')
    .eq('is_active', true)
    .in('name', clubNames)
  if (clubsError) {
    throw new Error(`Could not load active clubs. Apply official_club_directory.sql first. Details: ${clubsError.message}`)
  }

  const clubsByName = new Map((clubs ?? []).map((club) => [club.name, club]))
  const missingClubs = clubNames.filter((name) => !clubsByName.has(name))
  if (missingClubs.length > 0) {
    throw new Error(`These active clubs are missing: ${missingClubs.join(', ')}. Apply official_club_directory.sql first.`)
  }

  const { data: adminProfile, error: adminError } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  if (adminError) throw new Error(`Could not find an admin profile: ${adminError.message}`)
  if (!adminProfile) throw new Error('No admin profile found. Provision an admin account before seeding showcase data.')

  const { data: coordinatorProfiles, error: coordinatorError } = await admin
    .from('profiles')
    .select('id, club_id')
    .eq('role', 'coordinator')
  if (coordinatorError) throw new Error(`Could not load coordinator profiles: ${coordinatorError.message}`)

  const { data: bucket, error: bucketError } = await admin.storage.getBucket(CERTIFICATE_BUCKET)
  if (bucketError || !bucket) {
    throw new Error(`The private "${CERTIFICATE_BUCKET}" bucket is missing. Apply coordinator_attendance_and_certificates.sql first.`)
  }
  if (bucket.public) {
    throw new Error(`The "${CERTIFICATE_BUCKET}" bucket must be private before certificates can be seeded.`)
  }

  const students = new Map<string, { id: string; usn: string; name: string }>()
  for (const account of DEMO_ACCOUNTS) {
    students.set(account.key, await ensureDemoStudent(admin, account, password))
  }

  const eventIds: string[] = []
  const uploadedPaths: string[] = []

  try {
    const eventRows = EVENTS.map((definition) => {
      const club = clubsByName.get(definition.clubName)
      if (!club) throw new Error(`Club not found: ${definition.clubName}`)

      const dateTime = eventDate(definition.daysFromToday)
      const deadline = new Date(dateTime.getTime() - 2 * DAY_MS)
      const assignedCoordinator = coordinatorProfiles?.find((profile) => profile.club_id === club.id)

      return {
        key: definition.key,
        values: {
          club_id: club.id,
          title: definition.title,
          description:
            'Showcase sample data only. The date, venue, and event details are fictional and are not an official announcement.',
          date_time: dateTime.toISOString(),
          venue: definition.venue,
          contact: 'showcase@example.invalid',
          fee: 0,
          seat_limit: definition.seatLimit,
          registration_deadline: deadline.toISOString(),
          status: definition.status,
          created_by: assignedCoordinator?.id ?? adminProfile.id,
        },
      }
    })

    const { data: insertedEvents, error: eventError } = await admin
      .from('events')
      .insert(eventRows.map((row) => row.values))
      .select('id, title, club_id, date_time')
    if (eventError) throw new Error(`Could not create showcase events: ${eventError.message}`)

    for (const event of insertedEvents ?? []) {
      eventIds.push(event.id)
    }
    if (eventIds.length !== EVENTS.length) {
      throw new Error(`Expected ${EVENTS.length} showcase events, created ${eventIds.length}.`)
    }

    const eventsByKey = new Map<string, { id: string; title: string; date_time: string; club_id: string }>()
    for (const event of insertedEvents ?? []) {
      const definition = EVENTS.find((item) => item.title === event.title)
      if (definition) eventsByKey.set(definition.key, event)
    }

    const registrationRows = REGISTRATIONS.map((registration, index) => {
      const event = eventsByKey.get(registration.eventKey)
      const student = students.get(registration.studentKey)
      if (!event || !student) throw new Error(`Invalid showcase registration: ${registration.eventKey}`)
      return {
        event_id: event.id,
        student_id: student.id,
        status: registration.status,
        created_at: new Date(Date.now() - (REGISTRATIONS.length - index) * 60_000).toISOString(),
      }
    })

    const { data: insertedRegistrations, error: registrationError } = await admin
      .from('registrations')
      .insert(registrationRows)
      .select('id, event_id, student_id, status')
    if (registrationError) {
      throw new Error(`Could not create showcase registrations: ${registrationError.message}`)
    }

    const registrationByKey = new Map(
      (insertedRegistrations ?? []).map((registration) => [
        `${registration.event_id}:${registration.student_id}`,
        registration,
      ])
    )

    const certificateRows: Database['public']['Tables']['certificates']['Insert'][] = []
    for (const registration of REGISTRATIONS.filter((item) => item.status === 'attended')) {
      const event = eventsByKey.get(registration.eventKey)
      const student = students.get(registration.studentKey)
      if (!event || !student) throw new Error(`Could not prepare certificate for ${registration.eventKey}`)

      const savedRegistration = registrationByKey.get(`${event.id}:${student.id}`)
      if (!savedRegistration) throw new Error(`Attendance record missing for ${student.usn}`)

      const clubName = clubNames.find((name) => clubsByName.get(name)?.id === event.club_id)
      if (!clubName) throw new Error(`Club name missing for event ${event.title}`)

      const filePath = `${student.id}/${event.id}.pdf`
      const pdf = await buildCertificatePdf({
        studentName: student.name,
        eventTitle: event.title,
        eventDate: formatISTDate(event.date_time),
        clubName,
      })
      const { error: uploadError } = await admin.storage
        .from(CERTIFICATE_BUCKET)
        .upload(filePath, Buffer.from(pdf), { contentType: 'application/pdf', upsert: true })
      if (uploadError) throw new Error(`Could not upload ${student.usn}'s certificate: ${uploadError.message}`)
      uploadedPaths.push(filePath)
      certificateRows.push({
        registration_id: savedRegistration.id,
        event_id: event.id,
        student_id: student.id,
        file_path: filePath,
      })
    }

    const { error: certificateError } = await admin.from('certificates').insert(certificateRows)
    if (certificateError) throw new Error(`Could not record showcase certificates: ${certificateError.message}`)

    const fossCamp = eventsByKey.get('fossCamp')
    const enigma = eventsByKey.get('enigma')
    const studentOne = students.get('studentOne')
    const studentTwo = students.get('studentTwo')
    if (!fossCamp || !enigma || !studentOne || !studentTwo) {
      throw new Error('Required showcase records were not created.')
    }

    const { error: alertError } = await admin.from('alerts').insert([
      {
        user_id: studentOne.id,
        event_id: fossCamp.id,
        message: `${PREFIX}Your registration for FOSSCAMP is confirmed.`,
      },
      {
        user_id: studentTwo.id,
        event_id: enigma.id,
        message: `${PREFIX}You are on the ENIGMA waitlist.`,
      },
    ])
    if (alertError) throw new Error(`Could not create showcase alerts: ${alertError.message}`)

    console.log(`Created ${eventIds.length} clearly labelled showcase events.`)
    console.log(`Created ${registrationRows.length} sample registrations, including confirmed and waitlisted students.`)
    console.log(`Created ${certificateRows.length} private certificate PDFs and two showcase alerts.`)
    console.log('Student demo sign-ins (both use the SHOWCASE_PASSWORD you supplied):')
    console.log('  SHOWCASE01 — Ananya Showcase')
    console.log('  SHOWCASE02 — Rohan Showcase')
    console.log('One sample event proposal is pending for the Approver page.')
    console.log('Remove showcase events, registrations, alerts, and certificates with --clean. Demo auth accounts are kept.')
  } catch (error) {
    await rollbackSeed(admin, eventIds, uploadedPaths)
    throw error
  }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has('--help')) {
    console.log('Usage: npm run seed:showcase -- [--clean] [--confirm-remote]')
    console.log('Set SHOWCASE_PASSWORD to an 8+ character password for the two demo student accounts.')
    return
  }
  for (const arg of args) {
    if (arg !== '--clean' && arg !== '--confirm-remote') {
      throw new Error(`Unknown option: ${arg}`)
    }
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
    throw new Error(
      'The configured Supabase project is remote. Review the project, then rerun with --confirm-remote to write showcase data.'
    )
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (args.has('--clean')) {
    await removeShowcaseData(admin)
    return
  }

  const password = process.env.SHOWCASE_PASSWORD
  if (!password || password.length < 8) {
    throw new Error('Set SHOWCASE_PASSWORD to a password of at least 8 characters before seeding.')
  }

  await seed(admin, password)
}

main().catch((error: unknown) => {
  console.error(`Error: ${errorMessage(error)}`)
  process.exitCode = 1
})
