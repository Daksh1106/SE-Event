// PDF export of the confirmed registrations of one event (FR-11, TC-17)
// Authorisation is done inside get_event_registrations(): only the coordinator of the event's
// club (or an admin) gets rows; everybody else gets 403.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { formatISTDateTime } from '@/lib/datetime'
import { buildRegistrationsPdf } from '@/lib/pdf/registrations-pdf'
import { slugify } from '@/lib/pdf/text'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })
  }

  const profile = await getCurrentProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  if (profile.role !== 'coordinator' && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: eventData } = await supabase
    .from('events')
    .select('id, title, date_time, venue, seat_limit, clubs(name)')
    .eq('id', id)
    .maybeSingle()
  if (!eventData) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }
  const event = eventData as unknown as {
    id: string
    title: string
    date_time: string
    venue: string
    seat_limit: number
    clubs: { name: string } | null
  }

  const { data: rows, error } = await supabase.rpc('get_event_registrations', { p_event_id: id })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }

  const seated = (rows ?? []).filter(
    (r) => r.reg_status === 'confirmed' || r.reg_status === 'attended'
  )

  const bytes = await buildRegistrationsPdf({
    eventTitle: event.title,
    clubName: event.clubs?.name ?? '',
    eventDate: formatISTDateTime(event.date_time),
    venue: event.venue,
    seatLimit: event.seat_limit,
    rows: seated.map((r) => ({
      usn: r.usn,
      name: r.student_name,
      phone: r.phone,
      status: r.reg_status,
    })),
    generatedAt: formatISTDateTime(new Date()),
  })

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="registrations-${slugify(event.title)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
