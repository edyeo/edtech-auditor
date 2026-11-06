import { Fragment, type ReactNode } from 'react'
import { LoginPage } from '@/features/auth/components/login-page'
import { useAuthSession } from '@/features/auth/utils/use-auth-session'

/** Shows the app only to a signed-in user; the children restart when the account changes. */
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuthSession()

  if (auth.status === 'loading') {
    return <p className="text-sm text-muted-foreground">로그인 상태를 확인하는 중...</p>
  }
  if (auth.status === 'unconfigured') {
    return (
      <p role="alert" className="max-w-sm text-center text-sm text-red-500">
        로그인 설정이 없는 빌드입니다. VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해 주세요.
      </p>
    )
  }
  if (auth.status === 'signed-out') {
    return <LoginPage />
  }
  return <Fragment key={auth.session.user.id}>{children}</Fragment>
}
