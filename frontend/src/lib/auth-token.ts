import { supabase } from '@/lib/supabase-client'

/** The signed-in user's access token (refreshed first when it is about to expire); null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/** The signed-in user's id; null when signed out. */
export async function getUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** Drop the local session, e.g. after the server refused the token. */
export async function clearSession(): Promise<void> {
  await supabase?.auth.signOut({ scope: 'local' })
}
