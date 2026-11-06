import { Button } from '@/components/ui/button'
import { signOutOfAccount } from '@/features/auth/utils/auth.api'
import { useAuthSession } from '@/features/auth/utils/use-auth-session'

/** The signed-in email and a sign-out button; renders nothing while signed out. */
export function AccountBar() {
  const auth = useAuthSession()
  if (auth.status !== 'signed-in') return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
      <span className="break-all">{auth.session.user.email}</span>
      <Button type="button" variant="outline" size="sm" className="h-10 md:h-7" onClick={() => void signOutOfAccount()}>
        로그아웃
      </Button>
    </div>
  )
}
