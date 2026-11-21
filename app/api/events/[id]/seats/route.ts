// Live seat counts for one event (FR-7). Polled by the event page every few seconds.
// Runs on the server so the browser never talks to the database directly.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data, error } = await supabase.rpc('get_seat_counts', { p_event_ids: [id] })
  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const row = data[0]
  return NextResponse.json(
    {
      seatLimit: row.seat_limit,
      seatsTaken: row.seats_taken,
      waitlistCount: row.waitlist_count,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
