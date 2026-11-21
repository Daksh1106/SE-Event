// Coordinator Area Layout (FR-3, FR-4, NFR-8)
// Protected by requireRole(['coordinator', 'admin'])

import { requireRole } from '@/lib/auth'
import { PageShell } from '@/components/page-shell'

export default async function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(['coordinator', 'admin'])

  return <PageShell>{children}</PageShell>
}
