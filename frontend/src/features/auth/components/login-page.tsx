import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { signInWithGoogle } from '@/features/auth/utils/auth.api'

/** Google sends the learner back with ?error=... when the sign-in was refused or failed. */
function readOAuthError(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.has('error') || params.has('error_description') ? 'Google 로그인에 실패했습니다. 다시 시도해 주세요.' : null
}

/** Sign in with a Google account. Coming back signed in swaps this page for the app (see AuthGate). */
export function LoginPage() {
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(readOAuthError)

  // The message is already in state; clear the error parameters from the address bar.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname + window.location.hash)
  }, [])

  async function continueWithGoogle() {
    setError(null)
    setIsRedirecting(true)
    const result = await signInWithGoogle()
    // On success the browser is already on its way to Google.
    if (!result.ok) {
      setError(result.message)
      setIsRedirecting(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>로그인</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Google 계정으로 로그인하면 학습 기록(마킹, 풀이, 복습 일정)이 계정에 저장되어 기기를 바꿔도 이어집니다.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
        <Button type="button" className="h-11 md:h-9" disabled={isRedirecting} onClick={continueWithGoogle}>
          {isRedirecting ? 'Google로 이동 중...' : 'Google로 계속하기'}
        </Button>
      </CardContent>
    </Card>
  )
}
