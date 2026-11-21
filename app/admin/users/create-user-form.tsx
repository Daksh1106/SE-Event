// Create Staff User Client Form (FR-3, NFR-8, TC-4)
'use client'

import { useState, useTransition } from 'react'
import { createStaffUserAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ClubOption {
  id: string
  name: string
}

export function CreateUserForm({ clubs }: { clubs: ClubOption[] }) {
  const [selectedRole, setSelectedRole] = useState<'coordinator' | 'approver'>('coordinator')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    const form = event.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = await createStaffUserAction(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess('Staff account successfully provisioned!')
        form.reset()
        setSelectedRole('coordinator')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm rounded-md bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 text-sm rounded-md bg-green-50 text-green-700 border border-green-200">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="staff_id">Staff / Account ID *</Label>
          <Input
            id="staff_id"
            name="staff_id"
            placeholder="e.g. COORD02 or APPROV02"
            required
            className="uppercase font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" name="name" placeholder="e.g. Dr. Ramesh Kumar" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Temporary Password *</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role">Role *</Label>
          <select
            id="role"
            name="role"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as 'coordinator' | 'approver')}
            className="w-full h-8 px-2.5 py-1 text-sm rounded-md border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="coordinator">Club Coordinator</option>
            <option value="approver">Faculty Approver (HOD / Mentor)</option>
          </select>
        </div>
      </div>

      {selectedRole === 'coordinator' && (
        <div className="space-y-1.5">
          <Label htmlFor="club_id">Assigned Club *</Label>
          <select
            id="club_id"
            name="club_id"
            required={selectedRole === 'coordinator'}
            className="w-full h-8 px-2.5 py-1 text-sm rounded-md border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Select a college club...</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Coordinators manage and create events exclusively for their assigned club (NFR-8).
          </p>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? 'Provisioning Staff Account...' : 'Provision Staff Account'}
      </Button>
    </form>
  )
}
