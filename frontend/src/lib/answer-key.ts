import type { AnswerCheckResponse } from '@/types/question.types'

/** Every correct answer, so the browser can grade without asking the server each time. */
export type AnswerKey = {
  /** Correct choice indexes per question: the first is the main answer, the rest are also accepted. */
  questions: Record<string, number[]>
  /** Truth value of every O/X statement, keyed "question_id#statement_index". */
  ox: Record<string, boolean>
}

let keyPromise: Promise<AnswerKey> | null = null

/** One download per session (and the browser reuses it for a minute); a failed load is retried on the next call. */
export function loadAnswerKey(): Promise<AnswerKey> {
  keyPromise ??= fetch('/api/answer-key')
    .then((response) => {
      if (!response.ok) throw new Error(`요청이 실패했습니다 (${response.status})`)
      return response.json() as Promise<AnswerKey>
    })
    .catch((error) => {
      keyPromise = null
      throw error
    })
  return keyPromise
}

/** Grade a choice against the key; null when the key has no entry for the question. */
export function gradeChoice(key: AnswerKey, questionId: string, selectedIndex: number): AnswerCheckResponse | null {
  const accepted = key.questions[questionId]
  if (!accepted || accepted.length === 0) return null
  return {
    question_id: questionId,
    selected_index: selectedIndex,
    correct_index: accepted[0],
    correct_indexes: accepted,
    is_correct: accepted.includes(selectedIndex),
  }
}
