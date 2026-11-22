// "Generate certificates" button (FR-13, TC-19)
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { generateCertificatesAction } from '../_actions/coordinator-event-actions'

interface CertificateButtonProps {
  eventId: string
  attendedCount: number
  issuedCount: number
}

export function CertificateButton({ eventId, attendedCount, issuedCount }: CertificateButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function generate() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await generateCertificatesAction(eventId)
      if (result.error) setError(result.error)
      if (result.message) setMessage(result.message)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={generate} disabled={isPending || attendedCount === 0}>
          {isPending
            ? 'Generating…'
            : issuedCount > 0
              ? `Regenerate certificates (${attendedCount})`
              : `Generate certificates (${attendedCount})`}
        </Button>
        <span className="text-xs text-muted-foreground">
          {issuedCount} of {attendedCount} attended students have a certificate
        </span>
      </div>
      {attendedCount === 0 && (
        <p className="text-xs text-muted-foreground">
          Save attendance first: certificates are issued only to students marked as attended.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-green-800">
          {message}
        </p>
      )}
    </div>
  )
}
