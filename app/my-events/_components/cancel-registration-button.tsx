// Cancel / leave-waitlist button used on the My Events page (FR-9)
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cancelRegistrationAction } from '@/app/events/[id]/_actions/registration-actions'

interface CancelButtonProps {
  registrationId: string
  eventId: string
  status: 'confirmed' | 'waitlisted'
}

export function CancelButton({ registrationId, eventId, status }: CancelButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    const question =
      status === 'waitlisted'
        ? 'Leave the waitlist for this event?'
        : 'Cancel your registration? Your seat will go to the next student on the waitlist.'
    if (!window.confirm(question)) return

    setError(null)
    startTransition(async () => {
      const result = await cancelRegistrationAction(registrationId, eventId)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
        {isPending ? 'Please wait…' : status === 'waitlisted' ? 'Leave waitlist' : 'Cancel'}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
