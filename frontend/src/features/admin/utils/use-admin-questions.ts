import { useCallback, useState } from 'react'
import {
  AdminApiError,
  fetchAdminQuestions,
  resetAnswer,
  updateAnswer,
} from '@/features/admin/utils/admin.api'
import type { AdminQuestion } from '@/types/question.types'

const TOKEN_KEY = 'admin-token'

function readStoredToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function storeToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // sessionStorage unavailable — the token just won't survive a reload.
  }
}

/** Admin session: the token lives in sessionStorage only (cleared when the tab closes). */
export function useAdminQuestions() {
  const [token, setToken] = useState(readStoredToken)
  const [questions, setQuestions] = useState<AdminQuestion[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (nextToken: string) => {
    setIsLoading(true)
    setError(null)
    try {
      setQuestions(await fetchAdminQuestions(nextToken))
      setToken(nextToken)
      storeToken(nextToken)
    } catch (caught) {
      setQuestions(null)
      if (caught instanceof AdminApiError && caught.status === 401) storeToken('')
      setError(caught instanceof AdminApiError ? caught.message : '서버에 연결하지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const replace = useCallback((updated: AdminQuestion) => {
    setQuestions((current) => current?.map((q) => (q.id === updated.id ? updated : q)) ?? current)
  }, [])

  const saveAnswer = useCallback(
    async (questionId: string, answerIndexes: number[]) => replace(await updateAnswer(token, questionId, answerIndexes)),
    [token, replace],
  )

  const revertAnswer = useCallback(
    async (questionId: string) => replace(await resetAnswer(token, questionId)),
    [token, replace],
  )

  const signOut = useCallback(() => {
    storeToken('')
    setToken('')
    setQuestions(null)
  }, [])

  return { token, questions, isLoading, error, load, saveAnswer, revertAnswer, signOut }
}
