// Registration list as PDF (FR-11, TC-17): confirmed students of one event, ready to print.
// Handles long lists (200+ students) by adding pages and repeating the table header.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { fitText, toPdfText } from './text'

export interface RegistrationPdfRow {
  usn: string
  name: string | null
  phone: string | null
  status: string
}

export interface RegistrationsPdfInput {
  eventTitle: string
  clubName: string
  eventDate: string
  venue: string
  seatLimit: number
  rows: RegistrationPdfRow[]
  generatedAt: string
}

const PAGE_WIDTH = 595.28 // A4 portrait
const PAGE_HEIGHT = 841.89
const MARGIN = 40
const ROW_HEIGHT = 18
const COLUMNS = [
  { label: '#', width: 32 },
  { label: 'USN', width: 110 },
  { label: 'Name', width: 200 },
  { label: 'Phone', width: 100 },
  { label: 'Status', width: 73 },
] as const

export async function buildRegistrationsPdf(input: RegistrationsPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const title = toPdfText(input.eventTitle)
  const club = toPdfText(input.clubName)
  const pages: PDFPage[] = []

  function newPage(isFirst: boolean): { page: PDFPage; y: number } {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    pages.push(page)
    let y = PAGE_HEIGHT - MARGIN

    if (isFirst) {
      page.drawText('Confirmed Registrations', { x: MARGIN, y: y - 14, size: 11, font: bold, color: rgb(0.35, 0.35, 0.35) })
      y -= 36
      page.drawText(fitText(title, bold, 18, PAGE_WIDTH - 2 * MARGIN), { x: MARGIN, y, size: 18, font: bold })
      y -= 20
      const meta = [
        `Club: ${club}`,
        `Date: ${toPdfText(input.eventDate)}`,
        `Venue: ${toPdfText(input.venue)}`,
        `Confirmed participants: ${input.rows.length} of ${input.seatLimit} seats`,
      ]
      for (const line of meta) {
        page.drawText(fitText(line, regular, 10, PAGE_WIDTH - 2 * MARGIN), { x: MARGIN, y, size: 10, font: regular, color: rgb(0.2, 0.2, 0.2) })
        y -= 14
      }
      y -= 10
    }

    y = drawHeader(page, bold, y)
    return { page, y }
  }

  let { page, y } = newPage(true)

  input.rows.forEach((row, index) => {
    if (y < MARGIN + 30) {
      ;({ page, y } = newPage(false))
    }
    // zebra striping for readability when printed
    if (index % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - 5, width: PAGE_WIDTH - 2 * MARGIN, height: ROW_HEIGHT, color: rgb(0.96, 0.96, 0.97) })
    }
    const cells = [
      String(index + 1),
      toPdfText(row.usn),
      toPdfText(row.name) || '-',
      toPdfText(row.phone) || '-',
      toPdfText(row.status),
    ]
    let x = MARGIN
    COLUMNS.forEach((column, i) => {
      page.drawText(fitText(cells[i], regular, 10, column.width - 8), { x: x + 4, y, size: 10, font: regular })
      x += column.width
    })
    y -= ROW_HEIGHT
  })

  if (input.rows.length === 0) {
    page.drawText('No confirmed registrations yet.', { x: MARGIN + 4, y, size: 10, font: regular, color: rgb(0.4, 0.4, 0.4) })
  }

  // Footer with page numbers (second pass, once the page count is known)
  pages.forEach((p, i) => {
    p.drawText(`Page ${i + 1} of ${pages.length}  |  Generated ${toPdfText(input.generatedAt)}  |  College Event & Club Hub`, {
      x: MARGIN,
      y: 22,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.45, 0.45),
    })
  })

  return pdf.save()
}

function drawHeader(page: PDFPage, bold: PDFFont, y: number): number {
  page.drawRectangle({ x: MARGIN, y: y - 5, width: PAGE_WIDTH - 2 * MARGIN, height: ROW_HEIGHT, color: rgb(0.88, 0.9, 0.95) })
  let x = MARGIN
  for (const column of COLUMNS) {
    page.drawText(column.label, { x: x + 4, y, size: 10, font: bold })
    x += column.width
  }
  return y - ROW_HEIGHT
}
