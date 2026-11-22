'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, CalendarDays, Search, UsersRound } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface ClubEvent {
  id: string
  title: string
  dateLabel: string
}

interface DirectoryClub {
  id: string | null
  name: string
  description: string | null
  faculty_mentor: string | null
  logo: string
  events: ClubEvent[]
}

type ClubFilter = 'all' | 'upcoming' | 'mentor'

const filters: { id: ClubFilter; label: string }[] = [
  { id: 'all', label: 'All clubs' },
  { id: 'upcoming', label: 'With upcoming events' },
  { id: 'mentor', label: 'Mentor listed' },
]

export function ClubsDirectory({ clubs }: { clubs: DirectoryClub[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ClubFilter>('all')
  const normalizedQuery = query.trim().toLowerCase()

  const visibleClubs = clubs.filter((club) => {
    const matchesQuery =
      !normalizedQuery ||
      [club.name, club.description, club.faculty_mentor]
        .some((value) => value?.toLowerCase().includes(normalizedQuery))
    const matchesFilter =
      filter === 'all' ||
      (filter === 'upcoming' && club.events.length > 0) ||
      (filter === 'mentor' && Boolean(club.faculty_mentor))

    return matchesQuery && matchesFilter
  })

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-secondary px-6 py-8 sm:px-9 sm:py-10">
        <div className="absolute -right-10 -top-20 size-56 rounded-full border-[26px] border-primary/10" aria-hidden="true" />
        <div className="relative max-w-3xl space-y-3">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.17em] text-primary">
            <UsersRound className="size-4" aria-hidden="true" /> Campus community
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-secondary-foreground sm:text-4xl">
            Find your people.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-secondary-foreground/75 sm:text-base">
            Explore the official JSS STU clubs directory, meet the faculty mentors listed by the university, and see what&apos;s coming up.
          </p>
        </div>
      </section>

      <section aria-label="Search and filter clubs" className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clubs or faculty mentors"
            aria-label="Search clubs or faculty mentors"
            className="h-11 rounded-xl pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={filter === item.id ? 'default' : 'outline'}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className="rounded-full px-4"
            >
              {item.label}
            </Button>
          ))}
          {(query || filter !== 'all') && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery('')
                setFilter('all')
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{visibleClubs.length}</span>
          {' '}of {clubs.length} clubs
        </p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Details reflect the university clubs page
        </p>
      </div>

      {visibleClubs.length === 0 ? (
        <Card className="rounded-2xl border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Search className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold">No clubs match those filters</p>
              <p className="mt-1 text-sm text-muted-foreground">Try a different search or show all clubs.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery('')
                setFilter('all')
              }}
            >
              Show all clubs
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleClubs.map((club) => (
            <Card
              key={club.name}
              className="group relative overflow-hidden rounded-2xl border-border/80 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg"
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary/20" aria-hidden="true" />
              <CardHeader className="gap-3 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <Image
                    src={club.logo}
                    alt={`${club.name} logo`}
                    width={64}
                    height={64}
                    className="size-16 shrink-0 rounded-2xl bg-white p-1.5 object-contain ring-1 ring-border/70"
                  />
                  {club.events.length > 0 && club.id && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                      <CalendarDays className="size-3" aria-hidden="true" />
                      {club.events.length} upcoming
                    </span>
                  )}
                </div>
                <CardTitle className="text-xl leading-snug">{club.name}</CardTitle>
                <CardDescription className="min-h-10 leading-6">
                  {club.description || 'Explore the club through its activities and upcoming events.'}
                </CardDescription>
                <p className="border-t border-border/70 pt-3 text-xs leading-5 text-muted-foreground">
                  <span className="mb-1 block font-semibold uppercase tracking-wider text-foreground">Faculty mentor</span>
                  {club.faculty_mentor || 'Not listed on the university page'}
                </p>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2 border-t border-border/70 pt-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Upcoming events</h2>
                  {club.events.length > 0 ? (
                    <ul className="space-y-2">
                      {club.events.slice(0, 3).map((event) => (
                        <li key={event.id} className="flex items-start justify-between gap-3 text-sm">
                          <Link href={`/events/${event.id}`} className="font-medium transition-colors hover:text-primary hover:underline">
                            {event.title}
                          </Link>
                          <span className="shrink-0 text-right text-xs text-muted-foreground">{event.dateLabel}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No upcoming events announced.</p>
                  )}
                </div>

                {club.events.length > 0 && club.id && (
                  <Link
                    href={`/events?club=${club.id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full justify-between rounded-xl' })}
                  >
                    Browse this club&apos;s events <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
