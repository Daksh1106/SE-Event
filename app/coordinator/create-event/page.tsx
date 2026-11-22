// Coordinator Event Creation Page (FR-4, TC-5)
import { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CreateEventForm } from './_components/create-event-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Create Event | Coordinator Hub',
  description: 'Create an event and submit it for faculty approval.',
}

export default async function CreateEventPage() {
  const { profile } = await requireRole(['coordinator', 'admin'])
  const supabase = await createClient()

  let clubName = 'Unassigned'
  if (profile.club_id) {
    const { data: club } = await supabase
      .from('clubs')
      .select('name')
      .eq('id', profile.club_id)
      .eq('is_active', true)
      .single()
    if (club) clubName = club.name
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Club Event</h1>
        <p className="text-muted-foreground mt-1">
          Submit an event proposal for your club. All events are saved as Pending until approved
          by faculty approvers or HODs (FR-4, FR-5).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>
            Provide scheduling, capacity, fee, and venue information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateEventForm clubName={clubName} />
        </CardContent>
      </Card>
    </div>
  )
}
