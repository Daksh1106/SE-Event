// Role-aware Navigation Bar (FR-2, FR-3, NFR-1, NFR-8)
// Server Component: links depend on the signed-in role. On phones (< 768px) the links move into a
// dropdown menu built with <details>, so navigation works without any client-side JavaScript.

import Link from 'next/link'
import Image from 'next/image'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/(auth)/actions'
import { Button, buttonVariants } from '@/components/ui/button'
import type { AppRole } from '@/types/database'

interface NavLink {
  href: string
  label: string
  /** number shown as a small badge, e.g. unread alerts */
  badge?: number
}

function linksForRole(role: AppRole | undefined, unreadAlerts: number): NavLink[] {
  const links: NavLink[] = [{ href: '/events', label: 'Browse Events' }]

  if (role === 'student') {
    links.push({ href: '/my-events', label: 'My Events', badge: unreadAlerts })
    links.push({ href: '/certificates', label: 'Certificates' })
  }
  if (role === 'coordinator' || role === 'admin') {
    links.push({ href: '/coordinator', label: 'Coordinator' })
    links.push({ href: '/coordinator/create-event', label: '+ Create Event' })
  }
  if (role === 'approver' || role === 'admin') {
    links.push({ href: '/approver', label: 'Approvals' })
  }
  if (role === 'admin') {
    links.push({ href: '/admin/users', label: 'Manage Staff' })
  }

  links.push({ href: '/clubs', label: 'Clubs' })
  return links
}

export async function Navbar() {
  const profile = await getCurrentProfile()

  // Unread alert count for the "My Events" badge (FR-10)
  let unreadAlerts = 0
  if (profile?.role === 'student') {
    const supabase = await createClient()
    const { count } = await supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
    unreadAlerts = count ?? 0
  }

  const links = linksForRole(profile?.role, unreadAlerts)

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 shadow-[0_8px_24px_-22px_oklch(0.25_0.045_226/0.55)] backdrop-blur-md">
      <div className="h-1 bg-primary" />
      <div className="container mx-auto flex min-h-18 items-center justify-between gap-3 px-4 sm:px-6">
        {/* Brand + desktop links */}
        <div className="flex items-center gap-4 lg:gap-6 min-w-0">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <Image
              src="/logos/jss-stu.png"
              alt="JSS Science and Technology University logo"
              width={78}
              height={44}
              className="h-11 w-[78px] shrink-0 object-contain transition-transform group-hover:-rotate-2"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-base">
                College Event Hub
              </span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:block">
                JSS Science and Technology University
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                  className: 'text-muted-foreground hover:text-foreground',
                })}
              >
                {link.label}
                {link.badge ? (
                  <span className="ml-1.5 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {link.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side: mobile menu + account */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <details className="relative group lg:hidden">
            <summary
              className={`${buttonVariants({ variant: 'outline', size: 'sm' })} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}
              aria-label="Toggle navigation menu"
            >
              <span className="sm:hidden">Menu</span>
              <span className="hidden sm:inline">Navigation</span>
            </summary>
            <nav
              className="absolute right-0 top-full z-50 mt-2 flex w-64 flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-xl"
              aria-label="Mobile"
            >
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {link.label}
                  {link.badge ? (
                    <span className="ml-2 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {link.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>
          </details>

          {profile ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-32 truncate text-sm font-semibold leading-none">{profile.name || profile.usn}</p>
                <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {profile.role}
                </span>
              </div>

              <form action={logoutAction}>
                <Button variant="outline" size="sm" type="submit">
                  Log out
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                Log in
              </Link>
              <Link href="/signup" className={buttonVariants({ size: 'sm' })}>
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
