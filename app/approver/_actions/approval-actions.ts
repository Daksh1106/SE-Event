// Approver Server Actions (FR-5, NFR-14)
'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type DecideEventResult = {
  success?: boolean
  error?: string
}

/**
 * Executes an approval or rejection decision via transactional Postgres function 'decide_event'
 * Records approver ID, timestamp, and mandatory rejection rationale (FR-5, NFR-14).
 */
export async function decideEventAction(formData: FormData): Promise<DecideEventResult> {
  // CRITICAL: Ensure action-level approver role guard
  await requireRole(['approver', 'admin'])

  const eventId = formData.get('event_id') as string
  const decision = formData.get('decision') as string
  const reason = (formData.get('reason') as string)?.trim() || null

  if (!eventId) {
    return { error: 'Event ID is required.' }
  }

  if (decision !== 'approved' && decision !== 'rejected') {
    return { error: 'Decision must be either "approved" or "rejected".' }
  }

  if (decision === 'rejected' && (!reason || reason.length < 3)) {
    return { error: 'A specific rejection reason is mandatory when rejecting an event (FR-5).' }
  }

  const supabase = await createClient()

  // Execute atomic transactional decision in Postgres
  const { error } = await supabase.rpc('decide_event', {
    p_event_id: eventId,
    p_decision: decision,
    p_reason: reason,
  })

  if (error) {
    return { error: `Decision failed: ${error.message}` }
  }

  revalidatePath('/approver')
  revalidatePath('/coordinator')
  revalidatePath('/events')
  revalidatePath('/')

  return { success: true }
}
