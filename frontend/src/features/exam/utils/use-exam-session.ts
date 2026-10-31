import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuestionBank } from '@/lib/use-question-bank'
import { useReviewState } from '@/lib/use-review-state'
import { isDueForReview } from '@/features/exam/utils/is-due-for-review'
import { useQuestionAttempt } from '@/features/exam/utils/use-question-attempt'
import type { ReviewStateMap } from '@/types/learner.types'

export type SessionMode = 'due' | 'all'

/**
 * @param scopeIds when given, the session only covers those questions (practice a single
 *   question, or the marked set) and always runs in "all" mode.
 */
export function useExamSession(scopeIds?: string[]) {
  const { questions: bank, isLoading, error: loadError } = useQuestionBank()
  const questions = useMemo(
    () => (scopeIds ? bank.filter((question) => scopeIds.includes(question.id)) : bank),
    [bank, scopeIds],
  )
  const reviewState = useReviewState()
  const [mode, setMode] = useState<SessionMode>(scopeIds ? 'all' : 'due')
  // Queue order is frozen to this snapshot so grading a question (which changes reviewState)
  // doesn't reshuffle the queue and attach its result to a different question.
  const [queueReviewState, setQueueReviewState] = useState<ReviewStateMap>(reviewState)

  const [queueIndex, setQueueIndex] = useState(0)

  // Due-first queue: items that are due for review (or never attempted) sort
  // ahead of not-yet-due items, lowest box level (most overdue/weakest) first.
  // Subjects are interleaved by the ascending-box sort falling back to id order,
  // which naturally mixes subjects since ties are broken by insertion order.
  const queue = useMemo(() => {
    const withDueFlag = questions.map((question) => ({
      question,
      due: isDueForReview(queueReviewState[question.id]),
      boxLevel: queueReviewState[question.id]?.boxLevel ?? 0,
    }))
    const pool = mode === 'due' ? withDueFlag.filter((item) => item.due) : withDueFlag
    return [...pool].sort((a, b) => a.boxLevel - b.boxLevel).map((item) => item.question)
  }, [questions, queueReviewState, mode])

  const changeMode = useCallback(
    (next: SessionMode) => {
      setQueueReviewState(reviewState)
      setMode(next)
    },
    [reviewState],
  )

  const dueCount = useMemo(
    () => questions.filter((q) => isDueForReview(reviewState[q.id])).length,
    [questions, reviewState],
  )

  const currentQuestion = queue[queueIndex] ?? null
  const attempt = useQuestionAttempt(currentQuestion)
  const resetAttempt = attempt.reset

  // Switching modes can invalidate the current index — snap back to the queue start.
  useEffect(() => {
    setQueueIndex(0)
    resetAttempt()
  }, [mode, resetAttempt])

  const goToNextQuestion = useCallback(() => {
    setQueueIndex((index) => Math.min(index + 1, queue.length - 1))
    resetAttempt()
  }, [queue.length, resetAttempt])

  return {
    mode,
    setMode: changeMode,
    dueCount,
    totalCount: questions.length,
    isLoading,
    queue,
    queueIndex,
    currentQuestion,
    attempt,
    loadError,
    goToNextQuestion,
    hasNextQuestion: queueIndex < queue.length - 1,
  }
}
