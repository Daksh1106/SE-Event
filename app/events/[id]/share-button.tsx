// "Share on WhatsApp" (FR-16, TC-22): opens WhatsApp with the event title, date, venue and link.
'use client'

import { Button } from '@/components/ui/button'

interface ShareButtonProps {
  eventId: string
  title: string
  dateText: string
  venue: string
}

export function ShareButton({ eventId, title, dateText, venue }: ShareButtonProps) {
  function share() {
    const link = `${window.location.origin}/events/${eventId}`
    const message = `${title}\nDate: ${dateText}\nVenue: ${venue}\nRegister here: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
  }

  return (
    <Button type="button" variant="outline" onClick={share}>
      Share on WhatsApp
    </Button>
  )
}
