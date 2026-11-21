// Certificate download (FR-14, NFR-7, TC-19, TC-20)
// Two independent checks protect a certificate: the certificates table (RLS: students see only
// their own row) and the private storage bucket (policy: a student can only read the folder named
// after their own user id). A student cannot reach someone else's file by changing the link.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/pdf/text'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  if (!UUID_PATTERN.test(eventId)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data } = await supabase
    .from('certificates')
    .select('file_path, events(title)')
    .eq('event_id', eventId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
  }
  const cert = data as unknown as { file_path: string; events: { title: string } | null }

  const { data: file, error } = await supabase.storage.from('certificates').download(cert.file_path)
  if (error || !file) {
    return NextResponse.json({ error: 'Certificate file is not available' }, { status: 404 })
  }

  return new NextResponse(file, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${slugify(cert.events?.title ?? 'event')}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
