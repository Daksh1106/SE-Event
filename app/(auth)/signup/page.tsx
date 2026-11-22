// Signup Page (FR-1, NFR-1, NFR-2)
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, UsersRound } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SignupForm } from '../_components/signup-form'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Sign Up | College Event & Club Hub',
  description: 'Create an account with your USN to browse and register for college events.',
}

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-secondary p-10 lg:flex">
          <div className="absolute -right-20 top-1/4 size-72 rounded-full border-[34px] border-primary/10" aria-hidden="true" />
          <Link href="/" className="relative inline-flex items-center gap-3 text-sm font-bold">
            <span className="grid size-10 place-items-center rounded-xl bg-card text-secondary-foreground">JSS</span>
            <span>College Event Hub</span>
          </Link>
          <div className="relative space-y-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Make campus yours</p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-secondary-foreground">
              Find your next thing.
            </h1>
            <p className="max-w-sm text-sm leading-6 text-secondary-foreground/70">
              Create your student account to discover campus events, register and keep track of your experiences.
            </p>
            <div className="flex flex-wrap gap-4 pt-2 text-xs font-medium text-secondary-foreground/75">
              <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-primary" /> Campus events</span>
              <span className="inline-flex items-center gap-2"><UsersRound className="size-4 text-primary" /> Club community</span>
            </div>
          </div>
          <p className="relative text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/55">
            JSS Science and Technology University · Mysuru
          </p>
        </aside>

        <section className="flex items-center justify-center p-2 sm:p-8 lg:p-12">
          <div className="w-full max-w-md">
            <Link href="/" className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} mb-6 -ml-2`}>
              <ArrowLeft className="size-4" aria-hidden="true" /> Back to home
            </Link>
            <Card className="border-0 shadow-none">
              <CardHeader className="space-y-2 px-0">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Student registration</span>
                <CardTitle className="text-3xl font-bold tracking-tight">Create your account</CardTitle>
                <CardDescription className="leading-6">
                  Register with your university seat number to join the campus hub.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <SignupForm />
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}
