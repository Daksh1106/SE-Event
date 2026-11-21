// Events Directory (FR-6, FR-7, UR-1, TC-7, TC-8, TC-23)
// Shows approved upcoming events only, filterable by club and date, with live seats left.
// Pending and rejected events are never shown to students (also enforced by RLS).

import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatISTDateTime, hasPassed, parseISTLocal } from '@/lib/datetime'
import { seatSummary } from '@/lib/seats'
import { PageShell } from '@/components/page-shell'
import { SeatsBadge } from '@/components/seats-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Browse Events | College Event Hub',
  description: 'Discover upcoming approved events, technical workshops, and cultural fests.',
}

interface EventRow {
  id: string
  club_id: string
  title: string
  description: string | null
  date_time: string
  venue: string
  fee: number
  seat_limit: number
  registration_deadline: string
  clubs: { name: string } | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string; date?: string }>
}) {
  const params = await searchParams
  const clubFilter = params.club && UUID_PATTERN.test(params.club) ? params.club : ''
  const dateFilter = params.date && DATE_PATTERN.test(params.date) ? params.date : ''

  const supabase = await createClient()
  const now = new Date()

  let query = supabase
    .from('events')
    .select(
      'id, club_id, title, description, date_time, venue, fee, seat_limit, registration_deadline, clubs!inner(name)'
    )
    .eq('status', 'approved')
    .eq('clubs.is_active', true)
    .gte('date_time', now.toISOString()) // upcoming only (FR-6, TC-7)
    .order('date_time', { ascending: true })

  if (clubFilter) {
    query = query.eq('club_id', clubFilter)
  }

  // "Date" means the calendar day in IST
  const dayStart = dateFilter ? parseISTLocal(`${dateFilter}T00:00`) : null
  if (dayStart) {
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    query = query.gte('date_time', dayStart.toISOString()).lt('date_time', dayEnd.toISOString())
  }

  const [{ data: eventData, error }, { data: clubData }] = await Promise.all([
    query,
    supabase.from('clubs').select('id, name').eq('is_active', true).order('name'),
  ])

  const events = (eventData ?? []) as unknown as EventRow[]
  const clubs = clubData ?? []

  // Live seats for every listed event in one call
  const seatMap = new Map<string, { taken: number; waitlist: number }>()
  if (events.length > 0) {
    const { data: seatData } = await supabase.rpc('get_seat_counts', {
      p_event_ids: events.map((e) => e.id),
    })
    for (const row of seatData ?? []) {
      seatMap.set(row.event_id, { taken: row.seats_taken, waitlist: row.waitlist_count })
    }
  }

  const hasFilters = Boolean(clubFilter || dateFilter)

  return (
    <PageShell maxWidth="max-w-6xl">
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-secondary px-6 py-8 sm:px-9 sm:py-10">
        <div className="absolute -right-10 -top-20 size-56 rounded-full border-[26px] border-primary/10" aria-hidden="true" />
        <div className="relative max-w-3xl space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-primary">Discover campus life</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-secondary-foreground sm:text-4xl">Find your next campus event.</h1>
          <p className="max-w-2xl text-sm leading-6 text-secondary-foreground/75 sm:text-base">
            Browse faculty-approved events, check live seat availability, and save a place for what matters to you.
          </p>
        </div>
      </section>

      {/* Filters (FR-6) */}
      <form
        method="get"
        className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:p-5"
      >
        <div className="flex-1 space-y-1.5">
          <label htmlFor="club" className="text-sm font-medium">
            Club
          </label>
          <select
            id="club"
            name="club"
            defaultValue={clubFilter}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All clubs</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-1.5">
          <label htmlFor="date" className="text-sm font-medium">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={dateFilter}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          {hasFilters && (
            <Link href="/events" className={buttonVariants({ variant: 'outline' })}>
              Clear
            </Link>
          )}
        </div>
      </form>

      {error && (
        <div role="alert" className="p-3 text-sm rounded bg-red-50 text-red-700">
          Failed to load events: {error.message}
        </div>
      )}

      {!error && events.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <p className="text-base font-medium">
              {hasFilters
                ? 'No upcoming events match these filters.'
                : 'No approved upcoming events right now.'}
            </p>
            <p className="text-sm">
              {hasFilters
                ? 'Try another club or date, or clear the filters.'
                : 'Club coordinators will announce new activities here once approved.'}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map((evt) => {
          const seats = seatMap.get(evt.id) ?? { taken: 0, waitlist: 0 }
          const closed = hasPassed(evt.registration_deadline)
          const summary = seatSummary(evt.seat_limit, seats.taken, seats.waitlist, closed)

          return (
            <Card key={evt.id} className="group flex flex-col justify-between rounded-2xl border-border/80 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs uppercase font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                    {evt.clubs?.name}
                  </span>
                  <SeatsBadge summary={summary} />
                </div>
                <CardTitle className="text-xl mt-2 leading-snug">{evt.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {evt.description || 'No description provided.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <dl className="text-xs space-y-1 text-muted-foreground border-t pt-3">
                  <div>
                    <dt className="inline font-medium text-foreground">Date: </dt>
                    <dd className="inline">{formatISTDateTime(evt.date_time)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">Venue: </dt>
                    <dd className="inline">{evt.venue}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">Fee: </dt>
                    <dd className="inline">{evt.fee > 0 ? `₹${evt.fee}` : 'Free'}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">Register by: </dt>
                    <dd className="inline">{formatISTDateTime(evt.registration_deadline)}</dd>
                  </div>
                </dl>

                <Link
                  href={`/events/${evt.id}`}
                  className={buttonVariants({ variant: 'default', className: 'w-full rounded-xl' })}
                >
                  View Details & Register
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </PageShell>
  )
}
