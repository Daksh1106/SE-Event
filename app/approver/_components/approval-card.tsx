// Approver Action Card Component (FR-5, TC-6, NFR-14)
'use client'

import { useState, useTransition } from 'react'
import { decideEventAction } from '../_actions/approval-actions'
import { formatISTDateTime } from '@/lib/datetime'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface ApprovalCardEvent {
    id: string
    title: string
    description: string | null
    date_time: string
    venue: string
    contact: string | null
    fee: number
    seat_limit: number
    registration_deadline: string
    clubs?: { name: string; faculty_mentor: string | null } | null
    profiles?: { name: string | null; usn: string } | null
}

interface ApprovalCardProps {
  event: ApprovalCardEvent
}

export function ApprovalCard({ event }: ApprovalCardProps) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleDecision(decision: 'approved' | 'rejected') {
    setError(null)
    if (decision === 'rejected' && (!reason.trim() || reason.trim().length < 3)) {
      setError('Please provide a clear reason for rejecting the event proposal.')
      return
    }

    const formData = new FormData()
    formData.append('event_id', event.id)
    formData.append('decision', decision)
    if (decision === 'rejected') {
      formData.append('reason', reason.trim())
    }

    startTransition(async () => {
      const result = await decideEventAction(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="p-5 rounded-lg border bg-card space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
            {event.clubs?.name || 'Club Event'}
          </span>
          <h3 className="text-xl font-bold mt-1.5">{event.title}</h3>
          {event.description && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
              {event.description}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm py-2 border-y text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Date: </span>
          {formatISTDateTime(event.date_time)}
        </div>
        <div>
          <span className="font-medium text-foreground">Venue: </span>
          {event.venue}
        </div>
        <div>
          <span className="font-medium text-foreground">Fee: </span>
          {event.fee > 0 ? `₹${event.fee}` : 'Free'}
        </div>
        <div>
          <span className="font-medium text-foreground">Seat Limit: </span>
          {event.seat_limit}
        </div>
        <div>
          <span className="font-medium text-foreground">Deadline: </span>
          {formatISTDateTime(event.registration_deadline)}
        </div>
        <div>
          <span className="font-medium text-foreground">Submitted by: </span>
          {event.profiles?.name || event.profiles?.usn || 'Coordinator'}
        </div>
        {event.contact && (
          <div className="col-span-2">
            <span className="font-medium text-foreground">Contact: </span>
            {event.contact}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 text-sm rounded bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Decision Controls */}
      <div className="space-y-3 pt-1">
        {rejecting ? (
          <div className="space-y-2 p-3 bg-muted rounded-md">
            <Label htmlFor={`reason-${event.id}`}>Rejection Reason (Required for FR-5)</Label>
            <Input
              id={`reason-${event.id}`}
              placeholder="Explain why this proposal is rejected (e.g. venue scheduling conflict)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
            />
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDecision('rejected')}
                disabled={isPending}
              >
                {isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRejecting(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleDecision('approved')}
              disabled={isPending}
            >
              {isPending ? 'Processing...' : 'Approve Event'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setRejecting(true)}
              disabled={isPending}
            >
              Reject with Reason
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
