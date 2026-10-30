import type { OxFilter, OxItem } from '@/features/ox-quiz/types/ox-quiz.types'

export const DEFAULT_OX_FILTER: OxFilter = { year: 'all', subject: 'all', query: '' }

export function filterOxItems(items: OxItem[], filter: OxFilter): OxItem[] {
  const query = filter.query.trim().toLowerCase()

  return items.filter((item) => {
    if (filter.year !== 'all' && item.question.year !== filter.year) return false
    if (filter.subject !== 'all' && item.question.subject !== filter.subject) return false
    if (query && !item.statement.toLowerCase().includes(query)) return false
    return true
  })
}
