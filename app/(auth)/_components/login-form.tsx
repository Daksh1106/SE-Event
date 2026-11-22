// Student & Staff Login Form (FR-2, TC-3, NFR-1, NFR-2)
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { loginAction } from '../_actions/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await loginAction(formData)
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
        <Label htmlFor="usn">USN / Staff ID</Label>
        <Input
          id="usn"
          name="usn"
          type="text"
          placeholder="e.g. 01JST18CS001 or ADMIN01"
          required
          autoCapitalize="characters"
          className="uppercase tracking-wider font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Logging in...' : 'Log in'}
      </Button>

      <div className="text-center text-sm text-muted-foreground pt-2">
        Don&apos;t have an account yet?{' '}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          Register with USN
        </Link>
      </div>
    </form>
  )
}
