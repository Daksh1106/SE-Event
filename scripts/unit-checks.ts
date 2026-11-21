// Unit checks for the pure logic of the app: no database or network needed.
// Run with:  npx tsx scripts/unit-checks.ts
// Covers: IST dates (FR-4), event validation (FR-4, TC-5), seat wording (FR-7), the 24-hour
// banner window (FR-10), PDF generation (FR-11, FR-13).

import { PDFDocument } from 'pdf-lib'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { formatISTDateTime, hasPassed, parseISTLocal, startsWithinHours } from '../lib/datetime'
import { seatSummary } from '../lib/seats'
import { createEventSchema } from '../lib/validations/events'
import { loginSchema, signupSchema } from '../lib/validations/auth'
import { buildCertificatePdf, themeIndexForClub } from '../lib/pdf/certificate-pdf'
import { buildRegistrationsPdf } from '../lib/pdf/registrations-pdf'
import { slugify, toPdfText } from '../lib/pdf/text'
import { OFFICIAL_CLUBS } from '../lib/official-clubs'

let failed = 0
let total = 0
function check(name: string, ok: boolean, detail = '') {
  total += 1
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? '  -> ' + detail : ''}`)
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

async function main() {
  // --- Dates (FR-4) ---
  const d = parseISTLocal('2026-11-20T10:00')
  check('10:00 IST is stored as 04:30 UTC', d?.toISOString() === '2026-11-20T04:30:00.000Z')
  check('IST display round-trips', d !== null && formatISTDateTime(d) === '20 Nov 2026, 10:00 am')
  check('garbage dates are rejected', parseISTLocal('nope') === null && parseISTLocal('2026-13-45T10:00') === null)
  check('hasPassed', hasPassed(hoursFromNow(-1)) && !hasPassed(hoursFromNow(1)))

  // --- 24-hour banner window (FR-10) ---
  check('banner: starts in 2h', startsWithinHours(hoursFromNow(2), 24))
  check('banner: starts in 25h is outside', !startsWithinHours(hoursFromNow(25), 24))
  check('banner: already started is outside', !startsWithinHours(hoursFromNow(-1), 24))

  // --- Seat wording (FR-7) ---
  check('seats: plenty', seatSummary(100, 80, 0, false).label === '20 seats left')
  check('seats: almost full', seatSummary(100, 99, 0, false).label === 'Only 1 seat left')
  check('seats: full + waitlist', seatSummary(100, 100, 3, false).label === 'Full - waitlist open (3 waiting)')
  check('seats: never negative', seatSummary(10, 12, 0, false).seatsLeft === 0)
  check('seats: closed wins', seatSummary(100, 0, 0, true).tone === 'closed')

  // --- Event validation (FR-4, TC-5) ---
  const future = (days: number) =>
    new Date(Date.now() + days * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10) + 'T10:00'
  const base = { title: 'Hack Night', description: '', venue: 'Hall', contact: '', fee: '0', seat_limit: '50' }
  check('valid event accepted', createEventSchema.safeParse({ ...base, date_time: future(7), registration_deadline: future(5) }).success)
  check('missing title rejected (TC-5)', !createEventSchema.safeParse({ ...base, title: '', date_time: future(7), registration_deadline: future(5) }).success)
  check('past event rejected', !createEventSchema.safeParse({ ...base, date_time: '2020-01-01T10:00', registration_deadline: '2019-12-31T10:00' }).success)
  check('deadline after event rejected', !createEventSchema.safeParse({ ...base, date_time: future(5), registration_deadline: future(7) }).success)
  check('zero seats rejected', !createEventSchema.safeParse({ ...base, seat_limit: '0', date_time: future(7), registration_deadline: future(5) }).success)

  // --- USN validation (FR-1, TC-1) ---
  const signup = (usn: string) =>
    signupSchema.safeParse({ usn, password: 'secret123', confirmPassword: 'secret123', name: '', phone: '', email: '' })
  check('valid USN accepted and upper-cased', (() => { const r = signup('01jst18cs001'); return r.success && r.data.usn === '01JST18CS001' })())
  check('invalid USN rejected (TC-1)', !signup('INVALID').success && !signup('12345').success)
  check('login accepts staff IDs', loginSchema.safeParse({ usn: 'admin01', password: 'x' }).success)

  // --- Official club logos (FR-15) ---
  check(
    'every listed club has a unique supplied logo file',
    OFFICIAL_CLUBS.every((club) => existsSync(path.join(process.cwd(), 'public', club.logo))) &&
      new Set(OFFICIAL_CLUBS.map((club) => club.logo)).size === OFFICIAL_CLUBS.length
  )
  check(
    'DSC replaces the GDSC display name',
    OFFICIAL_CLUBS.some((club) => club.name === 'DSC-Developer Student Club') &&
      !OFFICIAL_CLUBS.some((club) => club.name === 'Google Developer Student Clubs - JSSSTU')
  )

  // --- PDFs (FR-11, FR-13) ---
  const cert = await buildCertificatePdf({ studentName: 'Ananya Rao', eventTitle: 'Hack Night', eventDate: '20 Nov 2026', clubName: 'CSI' })
  const certDoc = await PDFDocument.load(cert)
  check('certificate is a 1-page landscape PDF', certDoc.getPageCount() === 1 && certDoc.getPage(0).getWidth() > certDoc.getPage(0).getHeight())
  check('certificate theme is stable per club', themeIndexForClub('CSI') === themeIndexForClub('csi'))

  const longName = await buildCertificatePdf({ studentName: 'X'.repeat(300), eventTitle: 'Y '.repeat(200), eventDate: 'd', clubName: 'Z'.repeat(200) })
  check('certificate survives absurdly long text', (await PDFDocument.load(longName)).getPageCount() === 1)
  const odd = await buildCertificatePdf({ studentName: 'ಅನನ್ಯ 🎉', eventTitle: 'ಕಾರ್ಯಕ್ರಮ', eventDate: 'd', clubName: 'CSI' })
  check('certificate survives non-Latin text', (await PDFDocument.load(odd)).getPageCount() === 1)

  const rows = Array.from({ length: 205 }, (_, i) => ({ usn: `01JST24CB${String(i + 1).padStart(3, '0')}`, name: `Student ${i + 1}`, phone: null, status: 'confirmed' }))
  const list = await buildRegistrationsPdf({ eventTitle: 'Big Event', clubName: 'CSI', eventDate: 'd', venue: 'v', seatLimit: 200, rows, generatedAt: 'now' })
  check('205-student list spans several pages', (await PDFDocument.load(list)).getPageCount() > 3)
  const empty = await buildRegistrationsPdf({ eventTitle: 'Empty', clubName: 'CSI', eventDate: 'd', venue: 'v', seatLimit: 5, rows: [], generatedAt: 'now' })
  check('empty list still produces a PDF', (await PDFDocument.load(empty)).getPageCount() === 1)
  check('text helpers', toPdfText('a\nb\tc') === 'a b c' && slugify('Hack Night 2026!') === 'hack-night-2026')

  console.log(`\n${total - failed} of ${total} checks passed`)
  process.exit(failed ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
