// Session refresh helper for Next.js Edge Middleware
// Framework: @supabase/ssr
// Requirements: FR-2, NFR-6, NFR-8

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not run code between createServerClient and supabase.auth.getUser()
  // A simple mistake could cause difficult-to-debug session termination.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // Redirect unauthenticated users trying to access protected paths
  const protectedPrefixes = [
    '/events',
    '/my-events',
    '/certificates',
    '/clubs',
    '/coordinator',
    '/approver',
    '/admin',
  ]
  const isProtectedPath = protectedPrefixes.some((prefix) => url.pathname.startsWith(prefix))

  if (!user && isProtectedPath) {
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from /login and /signup to home
  if (user && (url.pathname === '/login' || url.pathname === '/signup')) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
