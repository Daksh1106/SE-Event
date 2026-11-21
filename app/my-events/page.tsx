// My Events (FR-9, FR-10, UR-2, UR-3, TC-16)
// Registered, waitlisted and past events, a banner for events starting within 24 hours, and the
// alert list (including "you were promoted from the waitlist").

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatISTDateTime, hasPassed, startsWithinHours } from '@/lib/datetime'
import { PageShell } from '@/components/page-shell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { MyRegistrationRow } from '@/types/database'
import { markAlertReadAction, markAllAlertsReadAction } from './actions'
import { CancelButton } from './cancel-button'

export const metadata: Metadata = {
  title: 'My Events | College Event Hub',
  description: 'Your registrations, waitlist positions, reminders and alerts.',
}

interface AlertRow {
  id: string
  event_id: string | null
  message: string
  is_read: boolean
  created_at: string
}

function EventLine({ row }: { row: MyRegistrationRow }) {
  return (
    <div className="min-w-0">
      <Link href={`/events/${row.event_id}`} className="font-semibold hover:underline">
        {row.title}
      </Link>
      <p className="text-xs text-muted-foreground">
        {row.club_name} &bull; {formatISTDateTime(row.date_time)} &bull; {row.venue}
      </p>
    </div>
  )
}

export default async function MyEventsPage() {
  const { user } = await requireRole(['student'])
  const supabase = await createClient()

  const [{ data: regData, error: regError }, { data: alertData }] = await Promise.all([
    supabase.rpc('get_my_registrations'),
    supabase
      .from('alerts')
      .select('id, event_id, message, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const registrations = regData ?? []
  const alerts = (alertData ?? []) as AlertRow[]
  const unreadCount = alerts.filter((a) => !a.is_read).length

  const confirmedUpcoming = registrations.filter(
    (r) => r.reg_status === 'confirmed' && !hasPassed(r.date_time)
  )
  const waitlisted = registrations.filter(
    (r) => r.reg_status === 'waitlisted' && !hasPassed(r.date_time)
  )
  const past = registrations
    .filter((r) => r.reg_status === 'attended' || hasPassed(r.date_time))
    .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())

  // Banner: confirmed events starting within the next 24 hours (FR-10)
  const startingSoon = confirmedUpcoming.filter((r) => startsWithinHours(r.date_time, 24))

  return (
    <PageShell maxWidth="max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Events</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Your registrations, waitlist positions, reminders and alerts.
        </p>
      </div>

      {regError && (
        <div role="alert" className="p-3 text-sm rounded bg-red-50 text-red-700">
          Failed to load your events: {regError.message}
        </div>
      )}

      {/* 24-hour reminder banner (FR-10, TC-16) */}
      {startingSoon.map((r) => (
        <div
          key={r.registration_id}
          role="status"
          className="p-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 text-sm"
        >
          <strong>Starting within 24 hours:</strong> {r.title} on {formatISTDateTime(r.date_time)} at{' '}
          {r.venue}.
        </div>
      ))}

      {/* Alerts (FR-10) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Alerts</CardTitle>
              <CardDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}`
                  : 'You are all caught up.'}
              </CardDescription>
            </div>
            {unreadCount > 0 && (
              <form action={markAllAlertsReadAction}>
                <Button type="submit" variant="outline" size="sm">
                  Mark all as read
                </Button>
              </form>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No alerts yet. You will be told here when a waitlist seat becomes yours.
            </p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className={`flex items-start justify-between gap-3 p-3 rounded-md border text-sm ${
                    alert.is_read ? 'bg-card text-muted-foreground' : 'bg-amber-50 border-amber-200 text-foreground'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <p className={alert.is_read ? '' : 'font-medium'}>{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatISTDateTime(alert.created_at)}
                      {alert.event_id && (
                        <>
                          {' '}
                          &bull;{' '}
                          <Link href={`/events/${alert.event_id}`} className="underline">
                            View event
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  {!alert.is_read && (
                    <form action={markAlertReadAction.bind(null, alert.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Mark read
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Registered */}
      <section className="space-y-3" aria-labelledby="registered-heading">
        <h2 id="registered-heading" className="text-lg font-semibold">
          Registered ({confirmedUpcoming.length})
        </h2>
        {confirmedUpcoming.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground space-y-2">
              <p>You have no confirmed upcoming events.</p>
              <Link href="/events" className={buttonVariants({ variant: 'link' })}>
                Browse events
              </Link>
            </CardContent>
          </Card>
        ) : (
          confirmedUpcoming.map((r) => (
            <Card key={r.registration_id}>
              <CardContent className="py-4 flex items-start justify-between gap-3 flex-wrap">
                <EventLine row={r} />
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-800">
                    Confirmed
                  </span>
                  <CancelButton registrationId={r.registration_id} eventId={r.event_id} status="confirmed" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* Waitlisted */}
      <section className="space-y-3" aria-labelledby="waitlist-heading">
        <h2 id="waitlist-heading" className="text-lg font-semibold">
          Waitlisted ({waitlisted.length})
        </h2>
        {waitlisted.length === 0 ? (
          <p className="text-sm text-muted-foreground">You are not on any waitlist.</p>
        ) : (
          waitlisted.map((r) => (
            <Card key={r.registration_id}>
              <CardContent className="py-4 flex items-start justify-between gap-3 flex-wrap">
                <EventLine row={r} />
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
                    Waitlist position {r.waitlist_position ?? '?'}
                  </span>
                  <CancelButton registrationId={r.registration_id} eventId={r.event_id} status="waitlisted" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* Past */}
      <section className="space-y-3" aria-labelledby="past-heading">
        <h2 id="past-heading" className="text-lg font-semibold">
          Past events ({past.length})
        </h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">Events you have taken part in will appear here.</p>
        ) : (
          past.map((r) => (
            <Card key={r.registration_id}>
              <CardContent className="py-4 flex items-start justify-between gap-3 flex-wrap">
                <EventLine row={r} />
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      r.reg_status === 'attended'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.reg_status === 'attended' ? 'Attended' : 'Did not attend'}
                  </span>
                  {r.certificate_issued && (
                    <a
                      href={`/certificates/${r.event_id}/download`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Download certificate
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </PageShell>
  )
}
