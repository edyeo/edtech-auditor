import type { QuestionStatsMap } from '@/types/learner.types'
import type { QuestionPublic } from '@/types/question.types'

export type QuestionFilter = {
  year: number | 'all'
  subject: string | 'all'
  query: string
  markedOnly: boolean
  wrongOnly: boolean
}

export const DEFAULT_QUESTION_FILTER: QuestionFilter = {
  year: 'all',
  subject: 'all',
  query: '',
  markedOnly: false,
  wrongOnly: false,
}

export function filterQuestions(
  questions: QuestionPublic[],
  filter: QuestionFilter,
  markedIds: ReadonlySet<string>,
  stats: QuestionStatsMap,
): QuestionPublic[] {
  const query = filter.query.trim().toLowerCase()

  return questions.filter((question) => {
    if (filter.year !== 'all' && question.year !== filter.year) return false
    if (filter.subject !== 'all' && question.subject !== filter.subject) return false
    if (filter.markedOnly && !markedIds.has(question.id)) return false
    if (filter.wrongOnly && !(stats[question.id]?.wrong > 0)) return false
    if (query) {
      const haystack = `${question.year} ${question.number}번 ${question.stem} ${question.choices.join(' ')}`
      if (!haystack.toLowerCase().includes(query)) return false
    }
    return true
  })
}
