import type { QuestionStatsMap } from '@/types/learner.types'
import type { QuestionPublic } from '@/types/question.types'

export type MiniTestScope = 'all' | 'wrong' | 'marked'

export type MiniTestConfig = {
  scope: MiniTestScope
  year: number | 'all'
  subject: string | 'all'
  count: number
}

export const MINI_TEST_COUNTS = [5, 10, 20] as const

export const SCOPE_LABELS: Record<MiniTestScope, string> = {
  all: '전체',
  wrong: '오답노트 (틀린 적 있는 문제)',
  marked: '마킹한 문항',
}

export function selectPool(
  questions: QuestionPublic[],
  config: Omit<MiniTestConfig, 'count'>,
  markedIds: ReadonlySet<string>,
  stats: QuestionStatsMap,
): QuestionPublic[] {
  return questions.filter((question) => {
    if (config.year !== 'all' && question.year !== config.year) return false
    if (config.subject !== 'all' && question.subject !== config.subject) return false
    if (config.scope === 'marked' && !markedIds.has(question.id)) return false
    if (config.scope === 'wrong' && !(stats[question.id]?.wrong > 0)) return false
    return true
  })
}

/** Fisher–Yates shuffle of a copy, then take `count`. `random` is injectable for tests. */
export function pickQuestions(pool: QuestionPublic[], count: number, random: () => number = Math.random): QuestionPublic[] {
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}

export function describeConfig(config: MiniTestConfig, questionCount: number): string {
  const parts = [SCOPE_LABELS[config.scope].replace(/ \(.*\)$/, '')]
  if (config.year !== 'all') parts.push(`${config.year}년`)
  if (config.subject !== 'all') parts.push(config.subject)
  parts.push(`${questionCount}문항`)
  return parts.join(' · ')
}
