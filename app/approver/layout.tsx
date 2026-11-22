// Approver Area Layout (FR-3, FR-5, NFR-8, NFR-14)
// Protected by requireRole(['approver', 'admin'])

import { requireRole } from '@/lib/auth'
import { PageShell } from '@/components/layout/page-shell'

export default async function ApproverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(['approver', 'admin'])

  return <PageShell>{children}</PageShell>
}
