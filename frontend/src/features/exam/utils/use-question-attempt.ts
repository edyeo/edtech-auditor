import { useCallback, useEffect, useRef, useState } from 'react'
import { computeNextReview } from '@/features/exam/utils/compute-next-review'
import { saveReviewState, submitAttempt } from '@/lib/learner-actions'
import { explainAnswer } from '@/lib/questions.api'
import { useReviewState } from '@/lib/use-review-state'
import type { QuestionPublic } from '@/types/question.types'

/** Everything about answering ONE question: choice, grading, review box and explanation. */
export function useQuestionAttempt(question: QuestionPublic | null) {
  const reviewState = useReviewState()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const [correctIndex, setCorrectIndex] = useState<number | null>(null)
  const [correctIndexes, setCorrectIndexes] = useState<number[]>([])
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [nextReviewDays, setNextReviewDays] = useState<number | null>(null)

  const [explanation, setExplanation] = useState<string | null>(null)
  const [isExplaining, setIsExplaining] = useState(false)
  const [explanationError, setExplanationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Lets an in-flight explanation request notice that the learner already moved on.
  const questionIdRef = useRef<string | null>(null)
  useEffect(() => {
    questionIdRef.current = question?.id ?? null
  }, [question?.id])

  const loadExplanation = useCallback(async (questionId: string) => {
    setIsExplaining(true)
    setExplanationError(null)
    try {
      const result = await explainAnswer(questionId)
      if (questionIdRef.current === questionId) setExplanation(result.explanation)
    } catch {
      if (questionIdRef.current === questionId) {
        setExplanationError('해설을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      if (questionIdRef.current === questionId) setIsExplaining(false)
    }
  }, [])

  const reset = useCallback(() => {
    setSelectedIndex(null)
    setCorrectIndex(null)
    setCorrectIndexes([])
    setIsCorrect(null)
    setNextReviewDays(null)
    setExplanation(null)
    setIsExplaining(false)
    setExplanationError(null)
    setSubmitError(null)
  }, [])

  const selectChoice = useCallback(
    (index: number) => {
      if (correctIndex !== null) return
      setSelectedIndex(index)
    },
    [correctIndex],
  )

  const canSubmit = selectedIndex !== null

  const submitAnswer = useCallback(async () => {
    if (!question || selectedIndex === null) return
    setSubmitError(null)
    let result
    try {
      // Grades the answer and records it (stats, markers) in one server call.
      result = (await submitAttempt(question.id, selectedIndex)).check
    } catch {
      setSubmitError('채점하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    setCorrectIndex(result.correct_index)
    setCorrectIndexes(result.correct_indexes)
    setIsCorrect(result.is_correct)

    const next = computeNextReview(reviewState[question.id], result.is_correct)
    setNextReviewDays(
      next.boxLevel === 0 ? 0 : Math.round((Date.parse(next.dueAt) - Date.now()) / 86_400_000),
    )
    void saveReviewState(question.id, next)
    // A wrong answer fetches the explanation right away; the server reuses the stored one.
    if (!result.is_correct) void loadExplanation(question.id)
  }, [question, selectedIndex, reviewState, loadExplanation])

  const requestExplanation = useCallback(async () => {
    if (question) await loadExplanation(question.id)
  }, [question, loadExplanation])

  return {
    selectedIndex,
    canSubmit,
    isChecked: correctIndex !== null,
    correctIndex,
    correctIndexes,
    isCorrect,
    nextReviewDays,
    explanation,
    isExplaining,
    explanationError,
    submitError,
    selectChoice,
    submitAnswer,
    requestExplanation,
    reset,
  }
}

export type QuestionAttempt = ReturnType<typeof useQuestionAttempt>
