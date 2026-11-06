import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { AuthMode } from '@/features/auth/types/auth.types'
import { signInWithEmail, signUpWithEmail } from '@/features/auth/utils/auth.api'

const MIN_PASSWORD_LENGTH = 6

/** Email + password sign-in and sign-up. Signing in swaps this page for the app (see AuthGate). */
export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isSignUp = mode === 'sign-up'

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (isSignUp && password.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`)
      return
    }
    setIsSubmitting(true)
    const result = isSignUp
      ? await signUpWithEmail(email.trim(), password)
      : await signInWithEmail(email.trim(), password)
    setIsSubmitting(false)

    if (!result.ok) {
      setError(result.message)
    } else if (result.needsEmailConfirmation) {
      setNotice('확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.')
      setMode('sign-in')
    }
    // Otherwise a session now exists and AuthGate replaces this page.
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isSignUp ? '가입하기' : '로그인'}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          학습 기록(마킹, 풀이, 복습 일정)이 계정에 저장되어 기기를 바꿔도 이어집니다.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            이메일
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            비밀번호
            <Input
              type="password"
              required
              minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-emerald-600">
              {notice}
            </p>
          )}
          <Button type="submit" className="h-11 md:h-9" disabled={isSubmitting}>
            {isSubmitting ? '처리 중...' : isSignUp ? '가입하기' : '로그인'}
          </Button>
        </form>
        <Button
          type="button"
          variant="ghost"
          className="h-11 md:h-9"
          onClick={() => switchMode(isSignUp ? 'sign-in' : 'sign-up')}
        >
          {isSignUp ? '이미 계정이 있어요 — 로그인' : '처음이에요 — 가입하기'}
        </Button>
      </CardContent>
    </Card>
  )
}
