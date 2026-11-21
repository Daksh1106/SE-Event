// Server Supabase client for Server Components, Server Actions & Route Handlers
// Framework: @supabase/ssr
// Requirements: FR-1 to FR-3, NFR-6, NFR-7, NFR-8, NFR-11
// Constraints: Service-role key only in server code; database access only on server.

import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

/**
 * Creates an authenticated Supabase client using the active user's session cookies.
 * Used for all standard server components, server actions, and route handlers.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}

/**
 * Creates an administrative Supabase client using SUPABASE_SECRET_KEY.
 * Strictly used in privileged server-only flows (e.g. admin staff provisioning FR-3, NFR-10).
 * Never exposed to client-side code.
 */
export async function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SECRET_KEY is not defined in environment variables.')
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    }
  )
}
