// Home Page - College Event & Club Hub (FR-1, FR-2, FR-6, NFR-1, NFR-2)
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, Award, CalendarDays, CircleCheck, Compass, Sparkles, UsersRound, type LucideIcon } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'
import { Navbar } from '@/components/navbar'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

async function DashboardContent() {
  const profile = await getCurrentProfile()

  if (profile) {
    return (
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-sm sm:p-9">
          <div className="absolute -right-14 -top-20 size-64 rounded-full border-[28px] border-primary/10" aria-hidden="true" />
          <div className="relative max-w-3xl space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" /> Your campus hub
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome back, {profile.name || profile.usn}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Pick up where you left off. Find what is happening across campus or open the tools for your role.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize text-secondary-foreground">
                {profile.role}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{profile.usn}</span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Quick access</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">What would you like to do?</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLink href="/events" title="Browse events" description="Find upcoming, faculty-approved campus events." icon={CalendarDays} />
            <QuickLink href="/clubs" title="Explore clubs" description="Meet the student clubs and their faculty mentors." icon={UsersRound} />
            {profile.role === 'student' && (
              <>
                <QuickLink href="/my-events" title="My registrations" description="Track your bookings, waitlists and alerts." icon={Compass} />
                <QuickLink href="/certificates" title="Certificates" description="Access certificates for events you attended." icon={Award} />
              </>
            )}
            {(profile.role === 'coordinator' || profile.role === 'admin') && (
              <QuickLink href="/coordinator" title="Coordinator workspace" description="Review your club events and their status." icon={Compass} />
            )}
            {(profile.role === 'approver' || profile.role === 'admin') && (
              <QuickLink href="/approver" title="Approvals" description="Review event proposals and recent decisions." icon={CircleCheck} />
            )}
            {profile.role === 'admin' && (
              <QuickLink href="/admin/users" title="Manage staff" description="Provision coordinator and approver accounts." icon={UsersRound} />
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-10 py-2 sm:py-6">
      <section className="relative isolate overflow-hidden rounded-3xl border border-border/80 bg-secondary px-6 py-10 sm:px-10 sm:py-14">
        <div className="absolute -right-24 -top-28 -z-10 size-96 rounded-full border-[42px] border-primary/10" aria-hidden="true" />
        <div className="absolute bottom-0 right-[14%] -z-10 h-40 w-40 rounded-t-full bg-primary/10" aria-hidden="true" />
        <div className="max-w-3xl space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-secondary-foreground/15 bg-card/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground">
            <span className="size-2 rounded-full bg-primary" />
            JSS Science and Technology University · Mysuru
          </span>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight text-secondary-foreground sm:text-6xl">
              Your campus,
              <span className="block text-primary">in motion.</span>
            </h1>
            <p className="max-w-2xl text-base leading-7 text-secondary-foreground/75 sm:text-lg">
              Discover what&apos;s happening, find the clubs behind it, and make your next campus moment count.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <Link href="/events" className={buttonVariants({ size: 'lg', className: 'gap-2' })}>
              Explore events <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/clubs" className={buttonVariants({ size: 'lg', variant: 'outline', className: 'border-secondary-foreground/20 bg-card/70' })}>
              Discover clubs
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs font-medium text-secondary-foreground/70">
            <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-primary" aria-hidden="true" /> Approved campus events</span>
            <span className="inline-flex items-center gap-2"><UsersRound className="size-4 text-primary" aria-hidden="true" /> Official club directory</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FeatureCard icon={CalendarDays} eyebrow="Find your next thing" title="Events worth showing up for" description="Browse approved campus activities and check live seat availability before you register." />
        <FeatureCard icon={UsersRound} eyebrow="Find your people" title="Get to know the clubs" description="Explore student groups and see the faculty mentors listed by the university." />
        <FeatureCard icon={Award} eyebrow="Make it count" title="Keep your achievements" description="Track your registrations and access participation certificates from one place." />
      </section>
    </div>
  )
}

function QuickLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-32 flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="mt-5">
        <span className="flex items-center justify-between gap-2 font-semibold">
          {title}
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
        </span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
      </span>
    </Link>
  )
}

function FeatureCard({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <Card className="group rounded-2xl border-border/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <span className="mb-2 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="leading-6">{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Suspense fallback={<div className="h-16 border-b bg-card animate-pulse" />}>
        <Navbar />
      </Suspense>

      <main className="flex-1 container mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded-lg" />}>
          <DashboardContent />
        </Suspense>
      </main>

      <footer className="border-t border-border/80 bg-card/70 py-6 text-center text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">College Event &amp; Club Hub</span>
        <span className="mx-2 text-primary">&middot;</span>
        JSS Science and Technology University
      </footer>
    </div>
  )
}
