// Participation certificate as PDF (FR-13, TC-19)
// Each club gets its own colour theme ("club template"); student name, event, date and club are
// printed on it. Landscape A4, built-in fonts only, so it works on any server.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { fitText, toPdfText, wrapText } from './text'

export interface CertificateInput {
  studentName: string
  eventTitle: string
  /** already formatted, e.g. "20 Nov 2026" */
  eventDate: string
  clubName: string
}

const WIDTH = 841.89 // A4 landscape
const HEIGHT = 595.28

// Club templates: the theme is picked from the club name, so every club always gets the same one
const THEMES = [
  { main: rgb(0.1, 0.29, 0.58), soft: rgb(0.9, 0.94, 0.99) }, // blue
  { main: rgb(0.55, 0.12, 0.2), soft: rgb(0.99, 0.92, 0.93) }, // maroon
  { main: rgb(0.08, 0.47, 0.33), soft: rgb(0.91, 0.98, 0.95) }, // green
  { main: rgb(0.5, 0.3, 0.07), soft: rgb(0.99, 0.95, 0.9) }, // bronze
  { main: rgb(0.33, 0.18, 0.55), soft: rgb(0.95, 0.92, 0.99) }, // purple
  { main: rgb(0.0, 0.42, 0.5), soft: rgb(0.9, 0.97, 0.98) }, // teal
] as const

export function themeIndexForClub(clubName: string): number {
  let sum = 0
  for (const char of clubName.toLowerCase()) sum += char.charCodeAt(0)
  return sum % THEMES.length
}

export async function buildCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([WIDTH, HEIGHT])

  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic)
  const serifBoldItalic = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic)
  const sans = await pdf.embedFont(StandardFonts.Helvetica)
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const club = toPdfText(input.clubName)
  const theme = THEMES[themeIndexForClub(club)]
  const dark = rgb(0.15, 0.15, 0.18)
  const grey = rgb(0.4, 0.4, 0.45)

  const centre = (text: string, font: typeof sans, size: number) =>
    (WIDTH - font.widthOfTextAtSize(text, size)) / 2

  // Background wash + double border
  page.drawRectangle({ x: 0, y: 0, width: WIDTH, height: HEIGHT, color: theme.soft })
  page.drawRectangle({ x: 22, y: 22, width: WIDTH - 44, height: HEIGHT - 44, borderColor: theme.main, borderWidth: 4, color: rgb(1, 1, 1) })
  page.drawRectangle({ x: 34, y: 34, width: WIDTH - 68, height: HEIGHT - 68, borderColor: theme.main, borderWidth: 1 })

  // Header band with the club name
  page.drawRectangle({ x: 34, y: HEIGHT - 96, width: WIDTH - 68, height: 62, color: theme.main })
  const clubHeading = fitText(club.toUpperCase(), sansBold, 22, WIDTH - 140)
  page.drawText(clubHeading, { x: centre(clubHeading, sansBold, 22), y: HEIGHT - 72, size: 22, font: sansBold, color: rgb(1, 1, 1) })
  const subHeading = 'JSS Science and Technology University'
  page.drawText(subHeading, { x: centre(subHeading, sans, 10), y: HEIGHT - 88, size: 10, font: sans, color: rgb(1, 1, 1) })

  // Title
  const title = 'CERTIFICATE OF PARTICIPATION'
  page.drawText(title, { x: centre(title, sansBold, 30), y: HEIGHT - 160, size: 30, font: sansBold, color: theme.main })

  const intro = 'This is to certify that'
  page.drawText(intro, { x: centre(intro, serifItalic, 16), y: HEIGHT - 205, size: 16, font: serifItalic, color: grey })

  // Student name (shrinks to fit long names)
  const name = toPdfText(input.studentName) || 'Participant'
  let nameSize = 40
  while (nameSize > 18 && serifBoldItalic.widthOfTextAtSize(name, nameSize) > WIDTH - 180) nameSize -= 2
  const shownName = fitText(name, serifBoldItalic, nameSize, WIDTH - 180)
  const nameWidth = serifBoldItalic.widthOfTextAtSize(shownName, nameSize)
  page.drawText(shownName, { x: (WIDTH - nameWidth) / 2, y: HEIGHT - 255, size: nameSize, font: serifBoldItalic, color: dark })
  page.drawLine({
    start: { x: (WIDTH - Math.max(nameWidth, 300)) / 2 - 20, y: HEIGHT - 266 },
    end: { x: (WIDTH + Math.max(nameWidth, 300)) / 2 + 20, y: HEIGHT - 266 },
    thickness: 1,
    color: theme.main,
  })

  const middle = 'has successfully participated in'
  page.drawText(middle, { x: centre(middle, serifItalic, 16), y: HEIGHT - 300, size: 16, font: serifItalic, color: grey })

  // Event title (up to two lines)
  const eventLines = wrapText(toPdfText(input.eventTitle) || 'the event', sansBold, 22, WIDTH - 180, 2)
  let lineY = HEIGHT - 336
  for (const line of eventLines) {
    page.drawText(line, { x: centre(line, sansBold, 22), y: lineY, size: 22, font: sansBold, color: dark })
    lineY -= 28
  }

  const organised = `organised by ${club} on ${toPdfText(input.eventDate)}`
  const shownOrganised = fitText(organised, serifItalic, 16, WIDTH - 180)
  page.drawText(shownOrganised, { x: centre(shownOrganised, serifItalic, 16), y: lineY - 4, size: 16, font: serifItalic, color: grey })

  // Signature lines
  const sigY = 92
  for (const [x, label] of [
    [110, 'Club Coordinator'],
    [WIDTH - 110 - 170, 'Faculty Mentor'],
  ] as const) {
    page.drawLine({ start: { x, y: sigY + 14 }, end: { x: x + 170, y: sigY + 14 }, thickness: 0.8, color: grey })
    page.drawText(label, { x: x + (170 - sans.widthOfTextAtSize(label, 10)) / 2, y: sigY, size: 10, font: sans, color: grey })
  }

  const footer = 'Issued through College Event & Club Hub'
  page.drawText(footer, { x: centre(footer, sans, 8), y: 48, size: 8, font: sans, color: grey })

  return pdf.save()
}
