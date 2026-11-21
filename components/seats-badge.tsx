// Coloured seat availability pill (FR-7, UR-1)
import { SEAT_TONE_CLASSES, type SeatSummary } from '@/lib/seats'

export function SeatsBadge({ summary }: { summary: SeatSummary }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEAT_TONE_CLASSES[summary.tone]}`}
    >
      {summary.label}
    </span>
  )
}
