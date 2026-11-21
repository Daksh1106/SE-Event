// My Certificates (FR-14, UR-3, TC-19, TC-20)
// Lists only the signed-in student's own certificates (RLS), each with a download link.

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatISTDate } from '@/lib/datetime'
import { PageShell } from '@/components/page-shell'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'My Certificates | College Event Hub',
  description: 'Download the participation certificates you have earned.',
}

interface CertificateRow {
  id: string
  event_id: string
  issued_on: string
  events: { title: string; date_time: string; clubs: { name: string } | null } | null
}

export default async function CertificatesPage() {
  const { user } = await requireRole(['student'])
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('certificates')
    .select('id, event_id, issued_on, events(title, date_time, clubs(name))')
    .eq('student_id', user.id)
    .order('issued_on', { ascending: false })

  const certificates = (data ?? []) as unknown as CertificateRow[]

  return (
    <PageShell maxWidth="max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Certificates</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Certificates are issued by club coordinators after an event, to students marked as attended.
        </p>
      </div>

      {error && (
        <div role="alert" className="p-3 text-sm rounded bg-red-50 text-red-700">
          Failed to load certificates: {error.message}
        </div>
      )}

      {!error && certificates.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground space-y-2">
            <p>You have no certificates yet.</p>
            <Link href="/events" className={buttonVariants({ variant: 'link' })}>
              Browse upcoming events
            </Link>
          </CardContent>
        </Card>
      )}

      {certificates.map((cert) => (
        <Card key={cert.id}>
          <CardContent className="py-4 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-semibold">{cert.events?.title ?? 'Event'}</p>
              <p className="text-xs text-muted-foreground">
                {cert.events?.clubs?.name}
                {cert.events ? ` • ${formatISTDate(cert.events.date_time)}` : ''} &bull; issued{' '}
                {formatISTDate(cert.issued_on)}
              </p>
            </div>
            <a
              href={`/certificates/${cert.event_id}/download`}
              className={buttonVariants({ variant: 'default', size: 'sm' })}
            >
              Download PDF
            </a>
          </CardContent>
        </Card>
      ))}
    </PageShell>
  )
}
