// Seat availability wording shared by the event list and the live seat counter (FR-7, UR-1)

export type SeatTone = 'open' | 'low' | 'full' | 'closed'

export interface SeatSummary {
  /** Seats still free (never negative) */
  seatsLeft: number
  tone: SeatTone
  label: string
}

/**
 * @param closed true when the registration deadline has passed
 */
export function seatSummary(
  seatLimit: number,
  seatsTaken: number,
  waitlistCount: number,
  closed: boolean
): SeatSummary {
  const seatsLeft = Math.max(seatLimit - seatsTaken, 0)

  if (closed) {
    return { seatsLeft, tone: 'closed', label: 'Registration closed' }
  }
  if (seatsLeft === 0) {
    const waiting = waitlistCount > 0 ? ` (${waitlistCount} waiting)` : ''
    return { seatsLeft, tone: 'full', label: `Full - waitlist open${waiting}` }
  }
  if (seatsLeft <= 5) {
    return {
      seatsLeft,
      tone: 'low',
      label: `Only ${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left`,
    }
  }
  return { seatsLeft, tone: 'open', label: `${seatsLeft} seats left` }
}

export const SEAT_TONE_CLASSES: Record<SeatTone, string> = {
  open: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  full: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  closed: 'bg-muted text-muted-foreground',
}
