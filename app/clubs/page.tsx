// Clubs Directory (FR-15, UR-4, TC-21)
// Read-only: each club's name, description, faculty mentor and its upcoming approved events.

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { formatISTDateTime } from '@/lib/datetime'
import { PageShell } from '@/components/layout/page-shell'
import { ClubsDirectory } from '@/components/features/clubs/clubs-directory'
import { OFFICIAL_CLUBS } from '@/lib/official-clubs'

export const metadata: Metadata = {
  title: 'Clubs | College Event Hub',
  description: 'Technical and cultural clubs at JSS STU, their mentors and upcoming events.',
}

interface ClubRow {
  id: string
  name: string
}

interface ClubEventRow {
  id: string
  club_id: string
  title: string
  date_time: string
}

export default async function ClubsPage() {
  const supabase = await createClient()

  const [{ data: clubData, error: clubError }, { data: eventData, error: eventError }] = await Promise.all([
    supabase.from('clubs').select('id, name').order('name'),
    supabase
      .from('events')
      .select('id, club_id, title, date_time')
      .eq('status', 'approved')
      .gte('date_time', new Date().toISOString())
      .order('date_time', { ascending: true }),
  ])

  const clubs = (clubData ?? []) as ClubRow[]
  const events = (eventData ?? []) as ClubEventRow[]

  const eventsByClub = new Map<string, ClubEventRow[]>()
  for (const event of events) {
    const list = eventsByClub.get(event.club_id) ?? []
    list.push(event)
    eventsByClub.set(event.club_id, list)
  }

  const directoryClubs = OFFICIAL_CLUBS.map((officialClub) => {
    const storedClub = clubs.find(
      (club) =>
        club.name === officialClub.name ||
        officialClub.legacyNames.includes(club.name)
    )

    return {
      ...officialClub,
      id: storedClub?.id ?? null,
      description: null,
      events: (storedClub ? eventsByClub.get(storedClub.id) ?? [] : []).map((event) => ({
        id: event.id,
        title: event.title,
        dateLabel: formatISTDateTime(event.date_time),
      })),
    }
  })

  return (
    <PageShell maxWidth="max-w-6xl">
      {(clubError || eventError) && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          The official club details are shown, but some upcoming event data could not be loaded:{' '}
          {(clubError ?? eventError)?.message}
        </div>
      )}
      <ClubsDirectory clubs={directoryClubs} />
    </PageShell>
  )
}
