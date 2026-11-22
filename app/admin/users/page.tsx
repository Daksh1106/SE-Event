// Admin Staff Management Page (FR-3, NFR-8, NFR-10, TC-4)
import { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CreateUserForm } from './_components/create-user-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Manage Staff Accounts | Admin Hub',
  description: 'Provision club coordinators and faculty approvers.',
}

interface StaffRow {
  id: string
  usn: string
  name: string | null
  role: string
  club_id: string | null
  created_at: string
  clubs: { name: string } | null
}

export default async function AdminUsersPage() {
  await requireRole(['admin'])
  const supabase = await createClient()

  // Fetch available clubs for coordinator assignment
  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Fetch existing staff members
  const { data: staffProfiles } = await supabase
    .from('profiles')
    .select('id, usn, name, role, club_id, created_at, clubs(name)')
    .neq('role', 'student')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staff Account Management</h1>
        <p className="text-muted-foreground mt-1">
          System administrators provision Coordinator and Approver accounts (FR-3, NFR-10).
          Students cannot assign themselves elevated roles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provision New Staff Account</CardTitle>
          <CardDescription>
            Assign an ID, password, and institutional role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateUserForm clubs={clubs || []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Staff Accounts</CardTitle>
          <CardDescription>
            Current coordinators, approvers, and administrators registered on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {staffProfiles && staffProfiles.length > 0 ? (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Staff ID / USN</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Assigned Club</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(staffProfiles as unknown as StaffRow[]).map((staff) => (
                    <tr key={staff.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono font-medium">{staff.usn}</td>
                      <td className="px-4 py-3">{staff.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary uppercase">
                          {staff.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {staff.clubs?.name || (staff.role === 'coordinator' ? 'Unassigned' : 'N/A')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No staff accounts provisioned yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
