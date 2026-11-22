// Administrator Area Layout (FR-3, NFR-8, NFR-10)
// Protected by requireRole(['admin'])

import { requireRole } from '@/lib/auth'
import { PageShell } from '@/components/layout/page-shell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(['admin'])

  return <PageShell>{children}</PageShell>
}
