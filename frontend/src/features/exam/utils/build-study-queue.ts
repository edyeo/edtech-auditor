import { isDueForReview } from '@/features/exam/utils/is-due-for-review'
import type { SessionMode } from '@/features/exam/utils/use-exam-session'
import { getQuestionSection } from '@/lib/question-section'
import type { ReviewStateMap } from '@/types/learner.types'
import type { QuestionPublic } from '@/types/question.types'

export type StudyFilter = {
  year: number | 'all'
  section: string | 'all'
  query: string
}

export const DEFAULT_STUDY_FILTER: StudyFilter = { year: 'all', section: 'all', query: '' }

export function filterStudyQuestions(questions: QuestionPublic[], filter: StudyFilter): QuestionPublic[] {
  const query = filter.query.trim().toLowerCase()

  return questions.filter((question) => {
    if (filter.year !== 'all' && question.year !== filter.year) return false
    if (filter.section !== 'all' && getQuestionSection(question) !== filter.section) return false
    if (query) {
      const haystack = `${question.year} ${question.number}번 ${question.stem} ${question.choices.join(' ')}`
      if (!haystack.toLowerCase().includes(query)) return false
    }
    return true
  })
}

/**
 * Review order: in "due" mode only questions due for review (or never attempted); in "all" mode every
 * question. Either way the weakest review box comes first, ties keeping the bank order.
 */
export function orderStudyQueue(
  questions: QuestionPublic[],
  reviewState: ReviewStateMap,
  mode: SessionMode,
): QuestionPublic[] {
  const entries = questions.map((question) => ({
    question,
    due: isDueForReview(reviewState[question.id]),
    boxLevel: reviewState[question.id]?.boxLevel ?? 0,
  }))
  const pool = mode === 'due' ? entries.filter((entry) => entry.due) : entries
  return [...pool].sort((a, b) => a.boxLevel - b.boxLevel).map((entry) => entry.question)
}
