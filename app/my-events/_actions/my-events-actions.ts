// Server actions for the My Events page: mark alerts as read (FR-10)
// Students can only change the is_read flag of their own alerts (column privilege + RLS).

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const idSchema = z.string().uuid()

export async function markAlertReadAction(alertId: string): Promise<void> {
  await requireRole(['student'])
  const parsed = idSchema.safeParse(alertId)
  if (!parsed.success) return

  const supabase = await createClient()
  await supabase.from('alerts').update({ is_read: true }).eq('id', parsed.data)

  revalidatePath('/my-events')
}

export async function markAllAlertsReadAction(): Promise<void> {
  const { user } = await requireRole(['student'])

  const supabase = await createClient()
  await supabase.from('alerts').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)

  revalidatePath('/my-events')
}
