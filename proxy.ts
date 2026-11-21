// Next.js Proxy (called "middleware" before Next 16)
// Refreshes the Supabase session on every request and redirects logged-out visitors away from
// protected pages. Role checks happen in the layouts and server actions (requireRole) and in RLS.
// Requirements: FR-2, NFR-6, NFR-8

import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - static image assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
