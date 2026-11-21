// Browser Supabase client for client-side components
// Framework: @supabase/ssr
// Requirements: NFR-6, NFR-11

import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  return createBrowserClient<Database>(supabaseUrl, supabaseKey)
}
