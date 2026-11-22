// Event page (FR-7, FR-8, FR-9, FR-16, UR-1, UR-2, TC-8)
// Description, venue, fee, contact, deadline, live seats left, and the registration controls.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatISTDateTime, hasPassed } from '@/lib/datetime'
import { PageShell } from '@/components/layout/page-shell'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LiveSeats } from './_components/live-seats'
import { RegistrationPanel } from './_components/registration-panel'
import { ShareButton } from './_components/share-button'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface EventDetail {
  id: string
  title: string
  description: string | null
  date_time: string
  venue: string
  contact: string | null
  fee: number
  seat_limit: number
  registration_deadline: string
  status: 'pending' | 'approved' | 'rejected'
  clubs: { name: string; faculty_mentor: string | null } | null
}

export const metadata: Metadata = {
  title: 'Event | College Event Hub',
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const supabase = await createClient()
  const profile = await getCurrentProfile()

  const { data } = await supabase
    .from('events')
    .select(
      'id, title, description, date_time, venue, contact, fee, seat_limit, registration_deadline, status, clubs!inner(name, faculty_mentor)'
    )
    .eq('id', id)
    .eq('clubs.is_active', true)
    .maybeSingle()

  // RLS already hides pending/rejected events from students
  if (!data) notFound()
  const event = data as unknown as EventDetail

  const deadlinePassed = hasPassed(event.registration_deadline)

  const { data: seatData } = await supabase.rpc('get_seat_counts', { p_event_ids: [id] })
  const seats = seatData?.[0]
  const seatsTaken = seats?.seats_taken ?? 0
  const waitlistCount = seats?.waitlist_count ?? 0
  const isFull = seatsTaken >= event.seat_limit

  // The signed-in student's own registration (with waitlist position)
  let registration: {
    id: string
    status: 'confirmed' | 'waitlisted' | 'attended'
    position: number | null
  } | null = null
  if (profile?.role === 'student') {
    const { data: mine } = await supabase.rpc('get_my_registrations')
    const row = mine?.find((r) => r.event_id === id)
    if (row && row.reg_status !== 'cancelled') {
      registration = {
        id: row.registration_id,
        status: row.reg_status as 'confirmed' | 'waitlisted' | 'attended',
        position: row.waitlist_position,
      }
    }
  }

  const dateText = formatISTDateTime(event.date_time)

  return (
    <PageShell maxWidth="max-w-3xl">
      <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; All events
      </Link>

      {event.status !== 'approved' && (
        <div className="p-3 text-sm rounded-md bg-amber-50 text-amber-900 border border-amber-200">
          This event is <strong>{event.status}</strong> and is not visible to students yet.
        </div>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
              {event.clubs?.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {event.fee > 0 ? `Fee: ₹${event.fee}` : 'Free event'}
            </span>
          </div>
          <CardTitle className="text-2xl sm:text-3xl">{event.title}</CardTitle>

          <LiveSeats
            key={`${event.seat_limit}-${seatsTaken}-${waitlistCount}-${deadlinePassed}`}
            eventId={event.id}
            seatLimit={event.seat_limit}
            initialTaken={seatsTaken}
            initialWaitlist={waitlistCount}
            closed={deadlinePassed}
          />
        </CardHeader>

        <CardContent className="space-y-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">Date &amp; time</dt>
              <dd>{dateText}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Venue</dt>
              <dd>{event.venue}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Registration deadline</dt>
              <dd>{formatISTDateTime(event.registration_deadline)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Fee</dt>
              <dd>
                {event.fee > 0 ? `₹${event.fee} (paid directly to the club)` : 'Free'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Contact</dt>
              <dd>{event.contact || 'Not provided'}</dd>
            </div>
            {event.clubs?.faculty_mentor && (
              <div>
                <dt className="font-medium text-muted-foreground">Faculty mentor</dt>
                <dd>{event.clubs.faculty_mentor}</dd>
              </div>
            )}
          </dl>

          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-1">About this event</h2>
            <p className="text-sm whitespace-pre-wrap">
              {event.description || 'No description provided.'}
            </p>
          </div>

          <div className="border-t pt-4 space-y-4">
            {profile?.role === 'student' && event.status === 'approved' ? (
              <RegistrationPanel
                eventId={event.id}
                registration={registration}
                deadlinePassed={deadlinePassed}
                isFull={isFull}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Only student accounts can register for events.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <ShareButton
                eventId={event.id}
                title={event.title}
                dateText={dateText}
                venue={event.venue}
              />
              {registration && (
                <Link href="/my-events" className={buttonVariants({ variant: 'ghost' })}>
                  Go to My Events
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  )
}
