import { useEffect, useState } from 'react'
import type { AuthState } from '@/features/auth/types/auth.types'
import { resetLearnerState } from '@/lib/learner-actions'
import { supabase } from '@/lib/supabase-client'

/** The Supabase Auth session: restored from storage on load, then kept in sync with sign-in/out and refreshes. */
export function useAuthSession(): AuthState {
  const [state, setState] = useState<AuthState>(supabase ? { status: 'loading' } : { status: 'unconfigured' })

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') resetLearnerState()
      setState(session ? { status: 'signed-in', session } : { status: 'signed-out' })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return state
}
