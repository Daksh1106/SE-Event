// Live seats-left counter (FR-7, UR-1). Polls /api/events/[id]/seats every 8 seconds while the tab
// is visible, so students see seats disappear without reloading.
'use client'

import { useEffect, useState } from 'react'
import { seatSummary } from '@/lib/seats'
import { SeatsBadge } from '@/components/seats-badge'

interface LiveSeatsProps {
  eventId: string
  seatLimit: number
  initialTaken: number
  initialWaitlist: number
  /** true when the registration deadline has passed (decided on the server) */
  closed: boolean
}

const POLL_INTERVAL_MS = 8000

export function LiveSeats({
  eventId,
  seatLimit,
  initialTaken,
  initialWaitlist,
  closed,
}: LiveSeatsProps) {
  const [taken, setTaken] = useState(initialTaken)
  const [waitlist, setWaitlist] = useState(initialWaitlist)
  const [limit, setLimit] = useState(seatLimit)
  // The page remounts this component (via its key) whenever the server-rendered numbers change,
  // for example after the student registers or cancels.

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      if (document.visibilityState !== 'visible') return
      try {
        const response = await fetch(`/api/events/${eventId}/seats`, { cache: 'no-store' })
        if (!response.ok) return
        const data = (await response.json()) as {
          seatLimit: number
          seatsTaken: number
          waitlistCount: number
        }
        if (!cancelled) {
          setLimit(data.seatLimit)
          setTaken(data.seatsTaken)
          setWaitlist(data.waitlistCount)
        }
      } catch {
        // Network hiccup: keep showing the last known numbers
      }
    }

    const timer = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [eventId])

  const summary = seatSummary(limit, taken, waitlist, closed)

  return (
    <div className="flex items-center gap-3 flex-wrap" aria-live="polite">
      <SeatsBadge summary={summary} />
      <span className="text-xs text-muted-foreground">
        {taken} of {limit} seats taken
        {waitlist > 0 ? ` · ${waitlist} on the waitlist` : ''}
      </span>
    </div>
  )
}
