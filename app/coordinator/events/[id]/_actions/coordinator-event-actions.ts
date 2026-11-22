// Server actions for managing one event: attendance and certificates (FR-12, FR-13, TC-18, TC-19)
// The database checks that the caller runs this club's event and that the student attended
// (mark_attendance / record_certificate); these actions only orchestrate the steps.

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { formatISTDate } from '@/lib/datetime'
import { buildCertificatePdf } from '@/lib/pdf/certificate-pdf'

export interface ManageResult {
  ok?: boolean
  message?: string
  error?: string
}

const eventIdSchema = z.string().uuid('Invalid event.')
const attendanceSchema = z.object({
  eventId: z.string().uuid('Invalid event.'),
  attendedIds: z.array(z.string().uuid()).max(2000),
})

/** FR-12: mark the confirmed students who actually attended */
export async function saveAttendanceAction(
  eventId: string,
  attendedRegistrationIds: string[]
): Promise<ManageResult> {
  await requireRole(['coordinator', 'admin'])

  const parsed = attendanceSchema.safeParse({ eventId, attendedIds: attendedRegistrationIds })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid request.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('mark_attendance', {
    p_event_id: parsed.data.eventId,
    p_attended_ids: parsed.data.attendedIds,
  })
  if (error) return { error: error.message }

  revalidatePath(`/coordinator/events/${parsed.data.eventId}`)
  const attended = (data as { attended?: number } | null)?.attended ?? 0
  return { ok: true, message: `Attendance saved: ${attended} student${attended === 1 ? '' : 's'} marked as attended.` }
}

/** FR-13: generate a certificate PDF for every attended student, store it privately, record it */
export async function generateCertificatesAction(eventId: string): Promise<ManageResult> {
  await requireRole(['coordinator', 'admin'])

  const parsedId = eventIdSchema.safeParse(eventId)
  if (!parsedId.success) return { error: 'Invalid event.' }

  const supabase = await createClient()

  const { data: eventData } = await supabase
    .from('events')
    .select('id, title, date_time, clubs(name)')
    .eq('id', parsedId.data)
    .maybeSingle()
  if (!eventData) return { error: 'Event not found.' }
  const event = eventData as unknown as {
    id: string
    title: string
    date_time: string
    clubs: { name: string } | null
  }

  const { data: rows, error: rowsError } = await supabase.rpc('get_event_registrations', {
    p_event_id: parsedId.data,
  })
  if (rowsError) return { error: rowsError.message }

  const attended = (rows ?? []).filter((row) => row.reg_status === 'attended')
  if (attended.length === 0) {
    return { error: 'Mark attendance first: certificates are issued only to students who attended.' }
  }

  const admin = await createAdminClient()
  const eventDate = formatISTDate(event.date_time)
  const clubName = event.clubs?.name ?? 'Club'

  let issued = 0
  const failures: string[] = []
  const BATCH_SIZE = 8

  for (let i = 0; i < attended.length; i += BATCH_SIZE) {
    await Promise.all(
      attended.slice(i, i + BATCH_SIZE).map(async (row) => {
        try {
          const bytes = await buildCertificatePdf({
            studentName: row.student_name || row.usn,
            eventTitle: event.title,
            eventDate,
            clubName,
          })

          const path = `${row.student_id}/${event.id}.pdf`
          const { error: uploadError } = await admin.storage
            .from('certificates')
            .upload(path, bytes, { contentType: 'application/pdf', upsert: true })
          if (uploadError) throw new Error(uploadError.message)

          const { error: recordError } = await supabase.rpc('record_certificate', {
            p_registration_id: row.registration_id,
            p_file_path: path,
          })
          if (recordError) throw new Error(recordError.message)

          issued += 1
        } catch (err) {
          failures.push(`${row.usn}: ${err instanceof Error ? err.message : 'failed'}`)
        }
      })
    )
  }

  revalidatePath(`/coordinator/events/${event.id}`)
  revalidatePath('/certificates')
  revalidatePath('/my-events')

  if (failures.length > 0) {
    return {
      ok: issued > 0,
      error: `Issued ${issued} of ${attended.length} certificates. Failed: ${failures.slice(0, 3).join('; ')}${failures.length > 3 ? '...' : ''}`,
      message: issued > 0 ? `Issued ${issued} certificates.` : undefined,
    }
  }
  return {
    ok: true,
    message: `Issued ${issued} certificate${issued === 1 ? '' : 's'}. Students can download them from their Certificates page.`,
  }
}
