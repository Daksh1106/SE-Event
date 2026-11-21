// Register / join waitlist / cancel panel for the event page (FR-8, FR-9, UR-2)
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cancelRegistrationAction, registerAction } from './actions'

interface RegistrationPanelProps {
  eventId: string
  registration: {
    id: string
    status: 'confirmed' | 'waitlisted' | 'attended'
    position: number | null
  } | null
  deadlinePassed: boolean
  isFull: boolean
}

export function RegistrationPanel({
  eventId,
  registration,
  deadlinePassed,
  isFull,
}: RegistrationPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<{ ok?: boolean; message?: string; error?: string }>) {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) setError(result.error)
      if (result.message) setMessage(result.message)
      router.refresh()
    })
  }

  function handleCancel() {
    if (!registration) return
    const question =
      registration.status === 'waitlisted'
        ? 'Leave the waitlist for this event?'
        : 'Cancel your registration? Your seat will go to the next student on the waitlist.'
    if (!window.confirm(question)) return
    run(() => cancelRegistrationAction(registration.id, eventId))
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="p-3 text-sm rounded-md bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="p-3 text-sm rounded-md bg-green-50 text-green-800 border border-green-200">
          {message}
        </div>
      )}

      {!registration && (
        <>
          {deadlinePassed ? (
            <div className="p-3 text-sm rounded-md bg-muted text-muted-foreground">
              Registration for this event has closed.
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={() => run(() => registerAction(eventId))}
              >
                {isPending ? 'Please wait…' : isFull ? 'Join waitlist' : 'Register now'}
              </Button>
              {isFull && (
                <p className="text-xs text-muted-foreground">
                  All seats are taken. Joining the waitlist keeps your place in line: if someone
                  cancels, the first student on the waitlist is confirmed automatically.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {registration?.status === 'confirmed' && (
        <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-md bg-green-50 text-green-800 border border-green-200">
          <span className="text-sm font-semibold">You are registered. Your seat is confirmed.</span>
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleCancel}>
            Cancel registration
          </Button>
        </div>
      )}

      {registration?.status === 'waitlisted' && (
        <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
          <span className="text-sm font-semibold">
            You are on the waitlist at position {registration.position ?? '?'}.
          </span>
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleCancel}>
            Leave waitlist
          </Button>
        </div>
      )}

      {registration?.status === 'attended' && (
        <div className="p-3 text-sm rounded-md bg-green-50 text-green-800 border border-green-200 font-semibold">
          You attended this event.
        </div>
      )}
    </div>
  )
}
