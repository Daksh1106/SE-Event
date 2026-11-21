// Admin Staff Management Actions (FR-3, NFR-8, NFR-10, TC-4)
'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { AppRole } from '@/types/database'

export type CreateStaffResult = {
  success?: boolean
  error?: string
}

const DOMAIN_SUFFIX = 'collegehub.org'

/**
 * Server action to provision a Coordinator or Approver staff account (FR-3, TC-4)
 * Explicitly guards against privilege escalation by checking requireRole(['admin'])
 * inside the action body.
 */
export async function createStaffUserAction(formData: FormData): Promise<CreateStaffResult> {
  // CRITICAL: Action-level role verification
  await requireRole(['admin'])

  const rawStaffId = (formData.get('staff_id') as string)?.trim().toUpperCase()
  const name = (formData.get('name') as string)?.trim() || null
  const password = (formData.get('password') as string)?.trim()
  const role = formData.get('role') as AppRole
  const clubId = (formData.get('club_id') as string)?.trim() || null

  if (!rawStaffId || rawStaffId.length < 3) {
    return { error: 'Staff ID is required (minimum 3 characters).' }
  }

  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters long.' }
  }

  if (role !== 'coordinator' && role !== 'approver') {
    return { error: 'Only Coordinator or Approver roles can be provisioned here.' }
  }

  if (role === 'coordinator' && !clubId) {
    return { error: 'A club assignment is required for Coordinator accounts.' }
  }

  const syntheticEmail = `${rawStaffId.toLowerCase()}@${DOMAIN_SUFFIX}`
  const adminClient = await createAdminClient()

  // 1. Create base auth user
  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
    user_metadata: {
      usn: rawStaffId,
      name,
    },
  })

  if (createError) {
    return { error: `Failed to create user: ${createError.message}` }
  }

  const userId = createData.user?.id
  if (!userId) {
    return { error: 'User creation failed: No user ID returned.' }
  }

  // 2. Set role and club_id explicitly on profiles row using admin client
  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({
      role,
      club_id: role === 'coordinator' ? clubId : null,
      name,
    })
    .eq('id', userId)

  if (profileUpdateError) {
    return { error: `User created, but role assignment failed: ${profileUpdateError.message}` }
  }

  revalidatePath('/admin/users')
  return { success: true }
}
