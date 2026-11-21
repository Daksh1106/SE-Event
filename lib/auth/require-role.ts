// Server-side Role Authorization Guard (FR-3, NFR-8)
// Enforces role-based access control inside Server Components, Layouts, and Server Actions.

import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppRole, Database } from '@/types/database'

export type ProfileRecord = Database['public']['Tables']['profiles']['Row']

/**
 * Validates that the active user is authenticated and possesses one of the allowed roles.
 * Must be executed in Server Components / Layouts and inside sensitive Server Actions.
 * Redirects to /login if unauthenticated, or to / if unauthorized.
 */
export async function requireRole(allowedRoles: AppRole[]): Promise<{
  user: { id: string; email?: string }
  profile: ProfileRecord
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    redirect('/login')
  }

  if (!allowedRoles.includes(profile.role)) {
    // Unauthorized access: redirect to home dashboard
    redirect('/')
  }

  return { user, profile }
}

/**
 * Helper to get the current profile if authenticated, or null if logged out.
 */
export async function getCurrentProfile(): Promise<ProfileRecord | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile || null
}
