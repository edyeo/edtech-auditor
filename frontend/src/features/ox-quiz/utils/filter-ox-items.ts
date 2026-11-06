import type { OxFilter, OxItem } from '@/features/ox-quiz/types/ox-quiz.types'
import type { OxStatsMap, QuestionStatsMap } from '@/types/learner.types'

export const DEFAULT_OX_FILTER: OxFilter = {
  year: 'all',
  subject: 'all',
  query: '',
  markedOnly: false,
  wrongOnly: false,
  solved: 'all',
  sort: 'random',
}

/**
 * Markers and wrong answers belong to the question, so every statement of a question passes or fails together.
 * "Solved" is per statement; `solvedStats` is a snapshot taken when the list was built, so a statement the
 * learner has just answered does not vanish from an "unsolved" list before its result is read.
 */
export function filterOxItems(
  items: OxItem[],
  filter: OxFilter,
  markedIds: ReadonlySet<string>,
  stats: QuestionStatsMap,
  solvedStats: OxStatsMap,
): OxItem[] {
  const query = filter.query.trim().toLowerCase()

  return items.filter((item) => {
    const questionId = item.question.id
    if (filter.year !== 'all' && item.question.year !== filter.year) return false
    if (filter.subject !== 'all' && item.question.subject !== filter.subject) return false
    if (filter.markedOnly && !markedIds.has(questionId)) return false
    if (filter.wrongOnly && !(stats[questionId]?.wrong > 0)) return false
    if (filter.solved !== 'all') {
      const solved = (solvedStats[item.key]?.attempts ?? 0) > 0
      if (solved !== (filter.solved === 'solved')) return false
    }
    if (query && !item.statement.toLowerCase().includes(query)) return false
    return true
  })
}
