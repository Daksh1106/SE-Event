// IST date/time helpers (FR-4, FR-6)
// The hub serves a single campus in India, so every date a coordinator types is IST and
// every date shown to users is rendered in IST - whatever time zone the server runs in
// (Vercel runs in UTC, which previously shifted events by 5h30m).

export const APP_TIME_ZONE = 'Asia/Kolkata'
const IST_OFFSET = '+05:30'

const DATE_TIME_LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/

/**
 * Parses the value of an <input type="datetime-local"> ("YYYY-MM-DDTHH:mm") as IST.
 * Returns null when the value is missing or not a real date/time.
 */
export function parseISTLocal(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = DATE_TIME_LOCAL.exec(value.trim())
  if (!match) return null
  const date = new Date(`${match[1]}T${match[2]}:${match[3] ?? '00'}${IST_OFFSET}`)
  return Number.isNaN(date.getTime()) ? null : date
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: APP_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

/** true when the given moment is already in the past (used for deadlines and event start) */
export function hasPassed(value: string | Date): boolean {
  return Date.now() > toDate(value).getTime()
}

/** true when the moment is still in the future but no more than `hours` hours away (24-hour banner, FR-10) */
export function startsWithinHours(value: string | Date, hours: number): boolean {
  const diff = toDate(value).getTime() - Date.now()
  return diff > 0 && diff <= hours * 60 * 60 * 1000
}

/** e.g. "20 Nov 2026" */
export function formatISTDate(value: string | Date): string {
  return dateFormatter.format(toDate(value))
}

/** e.g. "10:00 am" */
export function formatISTTime(value: string | Date): string {
  return timeFormatter.format(toDate(value))
}

/** e.g. "20 Nov 2026, 10:00 am" */
export function formatISTDateTime(value: string | Date): string {
  const date = toDate(value)
  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`
}
