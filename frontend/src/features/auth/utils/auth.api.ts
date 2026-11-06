import { supabase } from '@/lib/supabase-client'

export type AuthResult = { ok: true } | { ok: false; message: string }

/** Redirects the browser to Google; the session is created when Google sends the learner back. */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: '로그인 설정이 없는 빌드입니다.' }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  return error ? { ok: false, message: '로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.' } : { ok: true }
}

export async function signOutOfAccount(): Promise<void> {
  await supabase?.auth.signOut()
}
