// Manage one event: registrations, waitlist, attendance, PDF export, certificates
// (FR-11, FR-12, FR-13, NFR-8, TC-17, TC-18, TC-19)
// The list comes from get_event_registrations(), which only answers for the coordinator of this
// club (or an admin). Opening another club's event shows "Access denied", never its students.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatISTDateTime } from '@/lib/datetime'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AttendanceForm } from './_components/attendance-form'
import { CertificateButton } from './_components/certificate-button'

export const metadata: Metadata = {
  title: 'Manage Event | College Event Hub',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface EventInfo {
  id: string
  title: string
  date_time: string
  venue: string
  seat_limit: number
  registration_deadline: string
  status: string
  clubs: { name: string } | null
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

export default async function ManageEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const supabase = await createClient()

  const { data: eventData } = await supabase
    .from('events')
    .select('id, title, date_time, venue, seat_limit, registration_deadline, status, clubs(name)')
    .eq('id', id)
    .maybeSingle()
  if (!eventData) notFound()
  const event = eventData as unknown as EventInfo

  const { data: rows, error } = await supabase.rpc('get_event_registrations', { p_event_id: id })

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/coordinator" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to dashboard
        </Link>
        <div role="alert" className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
          <p className="font-semibold">Access denied</p>
          <p>{error.message}</p>
        </div>
      </div>
    )
  }

  const registrations = rows ?? []
  const seated = registrations.filter(
    (r) => r.reg_status === 'confirmed' || r.reg_status === 'attended'
  )
  const waitlist = registrations.filter((r) => r.reg_status === 'waitlisted')
  const attendedCount = registrations.filter((r) => r.reg_status === 'attended').length
  const issuedCount = registrations.filter((r) => r.certificate_issued).length

  return (
    <div className="space-y-6">
      <Link href="/coordinator" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to dashboard
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{event.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {event.clubs?.name} &bull; {formatISTDateTime(event.date_time)} &bull; {event.venue}
          </p>
          <p className="text-xs text-muted-foreground">
            Registration deadline: {formatISTDateTime(event.registration_deadline)}
          </p>
        </div>
        <a
          href={`/coordinator/events/${event.id}/pdf`}
          className={buttonVariants({ variant: 'outline' })}
        >
          Export confirmed list (PDF)
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Tile label="Seats" value={event.seat_limit} />
        <Tile label="Confirmed" value={seated.length} />
        <Tile label="Waitlisted" value={waitlist.length} />
        <Tile label="Attended" value={attendedCount} />
        <Tile label="Certificates" value={issuedCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance &amp; certificates</CardTitle>
          <CardDescription>
            Tick the confirmed students who attended and save. Then generate certificates for them.
            A student without a name on their profile gets their USN printed on the certificate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AttendanceForm
            eventId={event.id}
            rows={seated.map((r) => ({
              registrationId: r.registration_id,
              usn: r.usn,
              name: r.student_name,
              phone: r.phone,
              attended: r.reg_status === 'attended',
              certificateIssued: r.certificate_issued,
            }))}
          />
          <div className="border-t pt-4">
            <CertificateButton
              eventId={event.id}
              attendedCount={attendedCount}
              issuedCount={issuedCount}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waitlist ({waitlist.length})</CardTitle>
          <CardDescription>
            In order of joining. The first student is confirmed automatically when a seat opens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {waitlist.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is waiting.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2 w-14">#</th>
                    <th className="p-2">USN</th>
                    <th className="p-2">Name</th>
                    <th className="p-2 hidden sm:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map((r) => (
                    <tr key={r.registration_id} className="border-t">
                      <td className="p-2">{r.waitlist_position}</td>
                      <td className="p-2 font-mono text-xs whitespace-nowrap">{r.usn}</td>
                      <td className="p-2">{r.student_name || '-'}</td>
                      <td className="p-2 hidden sm:table-cell">{formatISTDateTime(r.registered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
