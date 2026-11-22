// Create Event Form Component (FR-4, TC-5, NFR-1, NFR-8)
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createEventAction } from '../../_actions/event-actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CreateEventFormProps {
  clubName: string
}

export function CreateEventForm({ clubName }: CreateEventFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await createEventAction(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="p-3 text-sm rounded-md bg-red-50 text-red-700 border border-red-200"
        >
          {error}
        </div>
      )}

      {/* Club affiliation info */}
      <div className="p-3 bg-muted rounded-md text-sm">
        <span className="text-muted-foreground">Hosting Club: </span>
        <span className="font-semibold text-foreground">{clubName}</span>
        <p className="text-xs text-muted-foreground mt-0.5">
          Events are strictly created under your assigned club affiliation (NFR-8).
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">Event Title *</Label>
        <Input
          id="title"
          name="title"
          placeholder="e.g. National Hackathon 2026"
          required
          minLength={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Event Description</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Describe the agenda, rules, and speaker details..."
          className="w-full p-2.5 text-sm rounded-md border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="date_time">Event Date & Time *</Label>
          <Input
            id="date_time"
            name="date_time"
            type="datetime-local"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="registration_deadline">Registration Deadline *</Label>
          <Input
            id="registration_deadline"
            name="registration_deadline"
            type="datetime-local"
            required
          />
          <p className="text-xs text-muted-foreground">Must be on or before event date</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="venue">Venue *</Label>
          <Input
            id="venue"
            name="venue"
            placeholder="e.g. CS Seminar Hall / Online"
            required
            minLength={2}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact">Contact Details</Label>
          <Input
            id="contact"
            name="contact"
            placeholder="e.g. coordinator@csi.org / +91 9876543210"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="seat_limit">Seat Limit *</Label>
          <Input
            id="seat_limit"
            name="seat_limit"
            type="number"
            min={1}
            placeholder="e.g. 150"
            required
          />
          <p className="text-xs text-muted-foreground">Maximum confirmed seats (NFR-4, NFR-5)</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fee">Registration Fee (₹) *</Label>
          <Input
            id="fee"
            name="fee"
            type="number"
            min={0}
            step="0.01"
            defaultValue="0"
            required
          />
          <p className="text-xs text-muted-foreground">Set 0 for free events</p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Submitting Event...' : 'Submit for Faculty Approval'}
        </Button>
        <Link href="/coordinator" className={buttonVariants({ variant: 'ghost' })}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
