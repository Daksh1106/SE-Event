// Coordinator Dashboard Page (FR-4, FR-11, NFR-8)
import { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatISTDateTime } from '@/lib/datetime'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Coordinator Dashboard | College Event Hub',
  description: 'Manage your club events, review approval status, and view participant counts.',
}

interface CoordinatorApproval {
  status: string
  reason: string | null
  decided_at: string | null
  approver_id: string
}

interface CoordinatorEvent {
  id: string
  title: string
  date_time: string
  venue: string
  fee: number
  seat_limit: number
  registration_deadline: string
  status: 'pending' | 'approved' | 'rejected'
  clubs: { name: string } | null
  approvals: CoordinatorApproval | CoordinatorApproval[] | null
}

export default async function CoordinatorDashboardPage() {
  const { profile } = await requireRole(['coordinator', 'admin'])
  const supabase = await createClient()

  // Fetch events for the coordinator's club with approval details
  let query = supabase
    .from('events')
    .select(`
      id,
      title,
      description,
      date_time,
      venue,
      fee,
      seat_limit,
      registration_deadline,
      status,
      created_at,
      clubs(name),
      approvals(status, reason, decided_at, approver_id)
    `)
    .order('created_at', { ascending: false })

  if (profile.role === 'coordinator' && profile.club_id) {
    query = query.eq('club_id', profile.club_id)
  }

  const { data: events, error } = await query

  // Live registration counts for approved events (FR-11)
  const approvedIds = ((events ?? []) as unknown as Array<{ id: string; status: string }>)
    .filter((e) => e.status === 'approved')
    .map((e) => e.id)
  const takenByEvent = new Map<string, number>()
  if (approvedIds.length > 0) {
    const { data: seatData } = await supabase.rpc('get_seat_counts', { p_event_ids: approvedIds })
    for (const row of seatData ?? []) takenByEvent.set(row.event_id, row.seats_taken)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coordinator Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your club events and monitor faculty approval decisions (FR-4, NFR-8).
          </p>
        </div>
        <Link href="/coordinator/create-event" className={buttonVariants({ size: 'default' })}>
          + Create New Event
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Club Events & Approval Status</CardTitle>
          <CardDescription>
            Events remain hidden from students while Pending. Once approved, registrations open.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 text-sm rounded bg-red-50 text-red-700">
              Failed to load events: {error.message}
            </div>
          )}

          {events && events.length > 0 ? (
            <div className="space-y-4">
              {(events as unknown as CoordinatorEvent[]).map((event) => {
                const approval = Array.isArray(event.approvals)
                  ? event.approvals[0]
                  : event.approvals

                return (
                  <div
                    key={event.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-lg">{event.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {event.clubs?.name} &bull; Scheduled:{' '}
                          {formatISTDateTime(event.date_time)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {event.status === 'pending' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Pending Approval
                          </span>
                        )}
                        {event.status === 'approved' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                            Approved
                          </span>
                        )}
                        {event.status === 'rejected' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                            Rejected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-sm grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">Venue: </span>
                        {event.venue}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Seats: </span>
                        {event.status === 'approved'
                          ? `${takenByEvent.get(event.id) ?? 0} / ${event.seat_limit} taken`
                          : event.seat_limit}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Fee: </span>
                        {event.fee > 0 ? `₹${event.fee}` : 'Free'}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Deadline: </span>
                        {formatISTDateTime(event.registration_deadline)}
                      </div>
                    </div>

                    {event.status === 'approved' && (
                      <div className="pt-1">
                        <Link
                          href={`/coordinator/events/${event.id}`}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          Manage registrations &amp; attendance
                        </Link>
                      </div>
                    )}

                    {/* Show Rejection Reason if Rejected (FR-4, FR-5) */}
                    {event.status === 'rejected' && approval?.reason && (
                      <div className="mt-2 p-3 rounded-md bg-red-50 text-red-800 text-xs dark:bg-red-950 dark:text-red-200">
                        <span className="font-semibold">Rejection Reason: </span>
                        {approval.reason}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No events submitted yet for your club.</p>
              <Link
                href="/coordinator/create-event"
                className={buttonVariants({ variant: 'link', className: 'mt-2' })}
              >
                Create your first event proposal
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
