import { authErrorMessage } from '@/features/auth/utils/auth-error-message'
import { supabase } from '@/lib/supabase-client'

export type AuthResult = { ok: true; needsEmailConfirmation: boolean } | { ok: false; message: string }

const NOT_CONFIGURED: AuthResult = { ok: false, message: '로그인 설정이 없는 빌드입니다.' }

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return NOT_CONFIGURED
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? { ok: false, message: authErrorMessage(error.code) } : { ok: true, needsEmailConfirmation: false }
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return NOT_CONFIGURED
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { ok: false, message: authErrorMessage(error.code) }
  // With "Confirm email" on, Supabase creates the user but returns no session until the link is opened.
  return { ok: true, needsEmailConfirmation: data.session === null }
}

export async function signOutOfAccount(): Promise<void> {
  await supabase?.auth.signOut()
}
