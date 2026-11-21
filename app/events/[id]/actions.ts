// Server actions: register for an event / cancel a registration (FR-8, FR-9, NFR-5)
// All rules (seat limit, deadline, waitlist, promotion) live in Postgres functions; these actions
// only check the caller's role and pass the request on.

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export interface ActionResult {
  ok?: boolean
  message?: string
  error?: string
}

const idSchema = z.string().uuid('Invalid id.')

function refreshEventPages(eventId?: string) {
  if (eventId) revalidatePath(`/events/${eventId}`)
  revalidatePath('/events')
  revalidatePath('/my-events')
}

export async function registerAction(eventId: string): Promise<ActionResult> {
  await requireRole(['student'])

  const parsed = idSchema.safeParse(eventId)
  if (!parsed.success) return { error: 'Invalid event.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('register_for_event', { p_event_id: parsed.data })
  if (error) return { error: error.message }

  const result = data as { status: string; position: number | null } | null
  refreshEventPages(parsed.data)

  if (result?.status === 'confirmed') {
    return { ok: true, message: 'You are registered and your seat is confirmed.' }
  }
  return {
    ok: true,
    message: `The event is full, so you are on the waitlist at position ${result?.position ?? '?'}. You will be promoted automatically if a seat opens.`,
  }
}

export async function cancelRegistrationAction(
  registrationId: string,
  eventId?: string
): Promise<ActionResult> {
  await requireRole(['student'])

  const parsed = idSchema.safeParse(registrationId)
  if (!parsed.success) return { error: 'Invalid registration.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('cancel_registration', {
    p_registration_id: parsed.data,
  })
  if (error) return { error: error.message }

  const result = data as { promoted_someone?: boolean } | null
  refreshEventPages(eventId)

  return {
    ok: true,
    message: result?.promoted_someone
      ? 'Registration cancelled. Your seat went to the next student on the waitlist.'
      : 'Registration cancelled.',
  }
}
