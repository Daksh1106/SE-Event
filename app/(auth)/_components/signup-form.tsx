// Student Registration Form (FR-1, TC-1, TC-2, NFR-1, NFR-2)
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { signupAction } from '../_actions/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await signupAction(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="p-3 text-sm rounded-md bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
        >
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="usn">USN (University Seat Number) *</Label>
        <Input
          id="usn"
          name="usn"
          type="text"
          placeholder="e.g. 01JST18CS001"
          required
          autoCapitalize="characters"
          className="uppercase tracking-wider font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Format: 2 digits, 3 letters, 2 digits, 2-3 letters, 3 digits
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
        />
        <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Full Name (Optional)</Label>
        <Input id="name" name="name" type="text" placeholder="e.g. Ramesh Kumar" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (Optional)</Label>
          <Input id="phone" name="phone" type="tel" placeholder="e.g. 9876543210" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email (Optional)</Label>
          <Input id="email" name="email" type="email" placeholder="student@example.com" />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creating Account...' : 'Create Account'}
      </Button>

      <div className="text-center text-sm text-muted-foreground pt-2">
        Already have an account?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Log in
        </Link>
      </div>
    </form>
  )
}
