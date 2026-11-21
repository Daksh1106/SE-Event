// Text helpers for PDF generation (FR-11, FR-13)
// pdf-lib's built-in fonts only cover Latin-1, so unsupported characters (for example Kannada or
// emoji in a profile name) are replaced with "?" instead of making the whole PDF fail.

import type { PDFFont } from 'pdf-lib'

/** Single-line, Latin-1-safe version of any user-provided text */
export function toPdfText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')
    .trim()
}

/** Shortens text with "..." so it fits in maxWidth at the given font size */
export function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let shortened = text
  while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) {
    shortened = shortened.slice(0, -1)
  }
  return `${shortened.trimEnd()}...`
}

/** Splits text into at most maxLines lines that fit maxWidth (last line is shortened if needed) */
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(' ').filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = fitText(`${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`, font, size, maxWidth)
    return kept
  }
  return lines.map((line) => fitText(line, font, size, maxWidth))
}

/** File-name friendly version of a title: "Hack Night 2026!" -> "hack-night-2026" */
export function slugify(value: string): string {
  const slug = toPdfText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'event'
}
