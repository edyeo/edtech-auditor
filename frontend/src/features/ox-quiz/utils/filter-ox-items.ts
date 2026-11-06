import type { OxFilter, OxItem } from '@/features/ox-quiz/types/ox-quiz.types'
import type { QuestionStatsMap } from '@/types/learner.types'

export const DEFAULT_OX_FILTER: OxFilter = {
  year: 'all',
  subject: 'all',
  query: '',
  markedOnly: false,
  wrongOnly: false,
  sort: 'random',
}

/** Markers and wrong answers belong to the question, so every statement of a question passes or fails together. */
export function filterOxItems(
  items: OxItem[],
  filter: OxFilter,
  markedIds: ReadonlySet<string>,
  stats: QuestionStatsMap,
): OxItem[] {
  const query = filter.query.trim().toLowerCase()

  return items.filter((item) => {
    const questionId = item.question.id
    if (filter.year !== 'all' && item.question.year !== filter.year) return false
    if (filter.subject !== 'all' && item.question.subject !== filter.subject) return false
    if (filter.markedOnly && !markedIds.has(questionId)) return false
    if (filter.wrongOnly && !(stats[questionId]?.wrong > 0)) return false
    if (query && !item.statement.toLowerCase().includes(query)) return false
    return true
  })
}
