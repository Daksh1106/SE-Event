// Attendance checklist (FR-12, TC-18): tick the confirmed students who attended, then save.
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { saveAttendanceAction } from './actions'

export interface AttendanceRow {
  registrationId: string
  usn: string
  name: string | null
  phone: string | null
  attended: boolean
  certificateIssued: boolean
}

export function AttendanceForm({ eventId, rows }: { eventId: string; rows: AttendanceRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.attended).map((r) => r.registrationId))
  )
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const savedIds = new Set(rows.filter((r) => r.attended).map((r) => r.registrationId))
  const hasChanges =
    checked.size !== savedIds.size || [...checked].some((id) => !savedIds.has(id))

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setChecked(new Set(rows.map((r) => r.registrationId)))
  }

  function clearAll() {
    // Students who already have a certificate stay ticked: their attendance cannot be withdrawn
    setChecked(new Set(rows.filter((r) => r.certificateIssued).map((r) => r.registrationId)))
  }

  function save() {
    setMessage(null)
    setError(null)
    const validIds = new Set(rows.map((r) => r.registrationId))
    const ids = [...checked].filter((id) => validIds.has(id))
    startTransition(async () => {
      const result = await saveAttendanceAction(eventId, ids)
      if (result.error) setError(result.error)
      if (result.message) setMessage(result.message)
      router.refresh()
    })
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No confirmed students yet.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={selectAll} disabled={isPending}>
          Select all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clearAll} disabled={isPending}>
          Clear all
        </Button>
        <span className="text-xs text-muted-foreground">
          {checked.size} of {rows.length} ticked
          {hasChanges ? ' (unsaved changes)' : ''}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2 w-10">
                <span className="sr-only">Attended</span>
              </th>
              <th className="p-2">USN</th>
              <th className="p-2">Name</th>
              <th className="p-2 hidden sm:table-cell">Phone</th>
              <th className="p-2">Certificate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.registrationId} className="border-t">
                <td className="p-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    aria-label={`Mark ${row.usn} as attended`}
                    checked={checked.has(row.registrationId)}
                    disabled={row.certificateIssued || isPending}
                    onChange={() => toggle(row.registrationId)}
                  />
                </td>
                <td className="p-2 font-mono text-xs whitespace-nowrap">{row.usn}</td>
                <td className="p-2">{row.name || <span className="text-muted-foreground">-</span>}</td>
                <td className="p-2 hidden sm:table-cell">{row.phone || '-'}</td>
                <td className="p-2 whitespace-nowrap">
                  {row.certificateIssued ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                      Issued
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not issued</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={isPending || !hasChanges}>
          {isPending ? 'Saving…' : 'Save attendance'}
        </Button>
        {error && (
          <span role="alert" className="text-sm text-red-700">
            {error}
          </span>
        )}
        {message && (
          <span role="status" className="text-sm text-green-800">
            {message}
          </span>
        )}
      </div>
    </div>
  )
}
