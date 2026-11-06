import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Only the origin counts: the dashboard also shows /rest/v1/ style addresses that would break the auth calls.
const rawUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL
const url = rawUrl ? safeOrigin(rawUrl) : undefined
const publishableKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

function safeOrigin(value: string): string | undefined {
  try {
    return new URL(value.trim()).origin
  } catch {
    return undefined
  }
}

/** Supabase Auth client; null when the project URL / public key are not configured for this build. */
export const supabase: SupabaseClient | null = url && publishableKey ? createClient(url, publishableKey) : null
