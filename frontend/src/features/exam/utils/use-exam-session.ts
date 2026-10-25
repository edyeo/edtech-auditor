import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { explainAnswer } from '@/lib/questions.api'
import { saveReviewState, submitAttempt } from '@/lib/learner-actions'
import { useQuestionBank } from '@/lib/use-question-bank'
import { useReviewState } from '@/lib/use-review-state'
import { computeNextReview } from '@/features/exam/utils/compute-next-review'
import { isDueForReview } from '@/features/exam/utils/is-due-for-review'
import type { ConfidenceLevel, ReviewStateMap } from '@/types/learner.types'

export const MIN_SELF_EXPLANATION_LENGTH = 6

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null)
  const [selfExplanation, setSelfExplanation] = useState('')

  const [correctIndex, setCorrectIndex] = useState<number | null>(null)
  const [correctIndexes, setCorrectIndexes] = useState<number[]>([])
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [overconfidentMiss, setOverconfidentMiss] = useState(false)
  const [nextReviewDays, setNextReviewDays] = useState<number | null>(null)

  const [explanation, setExplanation] = useState<string | null>(null)
  const [isExplaining, setIsExplaining] = useState(false)
  const [explanationError, setExplanationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

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
  // Lets an in-flight explanation request notice that the learner already moved on.
  const currentQuestionIdRef = useRef<string | null>(null)
  useEffect(() => {
    currentQuestionIdRef.current = currentQuestion?.id ?? null
  }, [currentQuestion?.id])

  const loadExplanation = useCallback(async (questionId: string) => {
    setIsExplaining(true)
    setExplanationError(null)
    try {
      const result = await explainAnswer(questionId)
      if (currentQuestionIdRef.current === questionId) setExplanation(result.explanation)
    } catch {
      if (currentQuestionIdRef.current === questionId) {
        setExplanationError('해설을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      if (currentQuestionIdRef.current === questionId) setIsExplaining(false)
    }
  }, [])

  const resetAttemptState = useCallback(() => {
    setSelectedIndex(null)
    setConfidence(null)
    setSelfExplanation('')
    setCorrectIndex(null)
    setCorrectIndexes([])
    setIsCorrect(null)
    setOverconfidentMiss(false)
    setNextReviewDays(null)
    setExplanation(null)
    setIsExplaining(false)
    setExplanationError(null)
    setSubmitError(null)
  }, [])

  // Switching modes can invalidate the current index — snap back to the queue start.
  useEffect(() => {
    setQueueIndex(0)
    resetAttemptState()
  }, [mode, resetAttemptState])

  const selectChoice = useCallback(
    (index: number) => {
      if (correctIndex !== null) return
      setSelectedIndex(index)
    },
    [correctIndex],
  )

  const canSubmit =
    selectedIndex !== null &&
    confidence !== null &&
    selfExplanation.trim().length >= MIN_SELF_EXPLANATION_LENGTH

  const submitAnswer = useCallback(async () => {
    if (!currentQuestion || selectedIndex === null || confidence === null) return
    setSubmitError(null)
    let result
    try {
      // Grades the answer and records it (stats, auto-mark) in one server call.
      result = (await submitAttempt(currentQuestion.id, selectedIndex)).check
    } catch {
      setSubmitError('채점하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    setCorrectIndex(result.correct_index)
    setCorrectIndexes(result.correct_indexes)
    setIsCorrect(result.is_correct)

    const previous = reviewState[currentQuestion.id]
    const next = computeNextReview(previous, result.is_correct, confidence)
    setOverconfidentMiss(next.overconfidentMiss)
    setNextReviewDays(
      next.boxLevel === 0 ? 0 : Math.round((Date.parse(next.dueAt) - Date.now()) / 86_400_000),
    )
    void saveReviewState(currentQuestion.id, next)
    // A wrong answer fetches the explanation right away; the server reuses the stored one.
    if (!result.is_correct) void loadExplanation(currentQuestion.id)
  }, [currentQuestion, selectedIndex, confidence, reviewState, loadExplanation])

  const requestExplanation = useCallback(async () => {
    if (currentQuestion) await loadExplanation(currentQuestion.id)
  }, [currentQuestion, loadExplanation])

  const goToNextQuestion = useCallback(() => {
    setQueueIndex((index) => Math.min(index + 1, queue.length - 1))
    resetAttemptState()
  }, [queue.length, resetAttemptState])

  return {
    mode,
    setMode: changeMode,
    dueCount,
    totalCount: questions.length,
    isLoading,
    queue,
    queueIndex,
    currentQuestion,
    selectedIndex,
    confidence,
    setConfidence,
    selfExplanation,
    setSelfExplanation,
    canSubmit,
    correctIndex,
    correctIndexes,
    isCorrect,
    overconfidentMiss,
    nextReviewDays,
    explanation,
    isExplaining,
    explanationError,
    submitError,
    loadError,
    selectChoice,
    submitAnswer,
    requestExplanation,
    goToNextQuestion,
    hasNextQuestion: queueIndex < queue.length - 1,
  }
}
