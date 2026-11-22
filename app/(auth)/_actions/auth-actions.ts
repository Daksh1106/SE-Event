// Server Actions for Authentication (FR-1, FR-2, FR-3, NFR-6, NFR-7, NFR-8)
// Enforces server-only authentication and database operations.
'use server'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { signupSchema, loginSchema } from '@/lib/validations/auth'

export type AuthActionResult = {
  success?: boolean
  error?: string
}

const DOMAIN_SUFFIX = 'collegehub.org'

/**
 * Handles student registration (FR-1, TC-1, TC-2)
 * Validates USN format, checks for duplicate accounts, and provisions account.
 * The database trigger 'handle_new_user' automatically provisions the profiles record with role='student'.
 * Saves optional name, phone, and contact email to profiles.
 */
export async function signupAction(formData: FormData): Promise<AuthActionResult> {
  const rawInput = {
    usn: formData.get('usn') as string,
    password: formData.get('password') as string,
    name: (formData.get('name') as string) || undefined,
    phone: (formData.get('phone') as string) || undefined,
    email: (formData.get('email') as string) || undefined,
  }

  // Zod validation with USN uppercase transformation
  const parseResult = signupSchema.safeParse(rawInput)
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0]?.message || 'Invalid input'
    return { error: firstError }
  }

  const { usn, password, name, phone, email } = parseResult.data
  const syntheticEmail = `${usn.toLowerCase()}@${DOMAIN_SUFFIX}`

  // Provision user via admin client to guarantee email_confirm without SMTP rate limits
  const adminClient = await createAdminClient()
  const { error: createError } = await adminClient.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
    user_metadata: {
      usn,
      name: name || null,
      phone: phone || null,
      contact_email: email || null,
    },
  })

  if (createError) {
    // TC-2: Reject duplicate USN with a friendly, USN-based message.
    // Match Supabase's specific duplicate codes (not every 422, which also covers weak passwords etc.)
    const isDuplicate =
      createError.code === 'email_exists' ||
      createError.code === 'user_already_exists' ||
      /already (been )?registered/i.test(createError.message)
    if (isDuplicate) {
      return { error: 'An account with this USN already exists. Please log in.' }
    }
    return { error: createError.message }
  }

  // Automatically sign the user in with session cookies
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  })

  if (signInError) {
    redirect('/login')
  }

  redirect('/')
}

/**
 * Handles student/staff login via USN/Staff ID and password (FR-2, TC-3)
 */
export async function loginAction(formData: FormData): Promise<AuthActionResult> {
  const rawInput = {
    usn: formData.get('usn') as string,
    password: formData.get('password') as string,
  }

  const parseResult = loginSchema.safeParse(rawInput)
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || 'Invalid credentials' }
  }

  const { usn, password } = parseResult.data
  const syntheticEmail = `${usn.toLowerCase()}@${DOMAIN_SUFFIX}`

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  })

  if (error) {
    // TC-3: Wrong credentials refused with clear feedback
    return { error: 'Invalid USN/Staff ID or password. Please try again.' }
  }

  redirect('/')
}

/**
 * Handles user logout (FR-2, TC-3)
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
