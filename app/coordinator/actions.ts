// Coordinator Server Actions (FR-4, NFR-8)
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createEventSchema } from '@/lib/validations/events'
import { parseISTLocal } from '@/lib/datetime'

export type CreateEventResult = {
  success?: boolean
  error?: string
}

/**
 * Creates a new event saved as 'pending' for faculty approval (FR-4, TC-5)
 * Derives club_id directly from the coordinator's profile - never from client input (NFR-8).
 */
export async function createEventAction(formData: FormData): Promise<CreateEventResult> {
  const { user, profile } = await requireRole(['coordinator', 'admin'])

  // Take club_id directly from the coordinator's verified profile
  let assignedClubId = profile.club_id

  // If admin creates on behalf of a club, fallback to form club_id if provided
  if (profile.role === 'admin' && !assignedClubId) {
    assignedClubId = (formData.get('club_id') as string) || null
  }

  if (!assignedClubId) {
    return {
      error: 'You do not have an assigned club. Only coordinators associated with a club can create events.',
    }
  }

  const rawInput = {
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || '',
    date_time: formData.get('date_time') as string,
    venue: formData.get('venue') as string,
    contact: (formData.get('contact') as string) || '',
    fee: formData.get('fee') as string,
    seat_limit: formData.get('seat_limit') as string,
    registration_deadline: formData.get('registration_deadline') as string,
  }

  const parseResult = createEventSchema.safeParse(rawInput)
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0]?.message || 'Invalid event parameters'
    return { error: firstError }
  }

  const validated = parseResult.data

  // Coordinators enter IST; convert explicitly so the server's time zone never shifts the event
  const eventDate = parseISTLocal(validated.date_time)
  const deadlineDate = parseISTLocal(validated.registration_deadline)
  if (!eventDate || !deadlineDate) {
    return { error: 'Invalid event date or registration deadline.' }
  }

  const supabase = await createClient()

  const { data: assignedClub, error: clubError } = await supabase
    .from('clubs')
    .select('id')
    .eq('id', assignedClubId)
    .eq('is_active', true)
    .maybeSingle()

  if (clubError) {
    return { error: `Failed to verify your club assignment: ${clubError.message}` }
  }
  if (!assignedClub) {
    return { error: 'Your assigned club is inactive. Ask an administrator to assign you to an active club.' }
  }

  const { error: insertError } = await supabase.from('events').insert({
    club_id: assignedClubId,
    title: validated.title,
    description: validated.description || null,
    date_time: eventDate.toISOString(),
    venue: validated.venue,
    contact: validated.contact || null,
    fee: validated.fee,
    seat_limit: validated.seat_limit,
    registration_deadline: deadlineDate.toISOString(),
    status: 'pending', // FR-4: Always saved as Pending
    created_by: user.id,
  })

  if (insertError) {
    return { error: `Failed to create event: ${insertError.message}` }
  }

  revalidatePath('/coordinator')
  revalidatePath('/approver')
  redirect('/coordinator')
}
