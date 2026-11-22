// Faculty & HOD Approver Dashboard Page (FR-5, TC-6, NFR-8, NFR-14)
import { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatISTDateTime } from '@/lib/datetime'
import { ApprovalCard, type ApprovalCardEvent } from './_components/approval-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Faculty Approver Dashboard | College Event Hub',
  description: 'Review pending event proposals, approve, or reject with feedback.',
}

interface DecidedApproval {
  status: string
  reason: string | null
  decided_at: string | null
  approver_id: string
}

interface DecidedEvent {
  id: string
  title: string
  status: string
  clubs: { name: string } | null
  approvals: DecidedApproval | DecidedApproval[] | null
}

export default async function ApproverDashboardPage() {
  await requireRole(['approver', 'admin'])
  const supabase = await createClient()

  // 1. Fetch pending events awaiting decision
  const { data: pendingEvents, error: pendingErr } = await supabase
    .from('events')
    .select(`
      id,
      title,
      description,
      date_time,
      venue,
      contact,
      fee,
      seat_limit,
      registration_deadline,
      status,
      created_at,
      clubs(name, faculty_mentor),
      profiles!events_created_by_fkey(name, usn)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // 2. Fetch decided events for accountability log (NFR-14)
  const { data: decidedEvents } = await supabase
    .from('events')
    .select(`
      id,
      title,
      status,
      clubs(name),
      approvals(status, reason, decided_at, approver_id)
    `)
    .in('status', ['approved', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Faculty Event Approvals</h1>
        <p className="text-muted-foreground mt-1">
          Review pending club events. Every approval or rejection is transactionally audited
          with decision rationale and timestamp (FR-5, NFR-14).
        </p>
      </div>

      {/* Pending Events Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Pending Proposals ({pendingEvents ? pendingEvents.length : 0})
          </h2>
        </div>

        {pendingErr && (
          <div className="p-3 text-sm rounded bg-red-50 text-red-700">
            Failed to load pending proposals: {pendingErr.message}
          </div>
        )}

        {pendingEvents && pendingEvents.length > 0 ? (
          <div className="space-y-4">
            {(pendingEvents as unknown as ApprovalCardEvent[]).map((event) => (
              <ApprovalCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No pending event proposals awaiting review.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Decision Audit History (NFR-14) */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Decisions Audit Log (NFR-14)</CardTitle>
          <CardDescription>
            Accountability trail recording the timestamp, decision, and rejection reasons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {decidedEvents && decidedEvents.length > 0 ? (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Event</th>
                    <th className="px-4 py-2.5">Club</th>
                    <th className="px-4 py-2.5">Decision</th>
                    <th className="px-4 py-2.5">Decided At</th>
                    <th className="px-4 py-2.5">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(decidedEvents as unknown as DecidedEvent[]).map((evt) => {
                    const approval = Array.isArray(evt.approvals)
                      ? evt.approvals[0]
                      : evt.approvals

                    return (
                      <tr key={evt.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2.5 font-medium">{evt.title}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{evt.clubs?.name}</td>
                        <td className="px-4 py-2.5">
                          {evt.status === 'approved' ? (
                            <span className="text-xs px-2 py-0.5 rounded font-semibold bg-green-100 text-green-800">
                              Approved
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded font-semibold bg-red-100 text-red-800">
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {approval?.decided_at
                            ? formatISTDateTime(approval.decided_at)
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {approval?.reason || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">No past approval decisions recorded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
