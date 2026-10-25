import { getLearnerId } from '@/lib/learner-id'
import type {
  MiniTestRecord,
  QuestionMark,
  QuestionMarkMap,
  QuestionStats,
  QuestionStatsMap,
  ReviewState,
  ReviewStateMap,
} from '@/types/learner.types'
import type { AnswerCheckResponse } from '@/types/question.types'

export class LearnerApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function learnerRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/learner${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Learner-Id': getLearnerId() },
  })
  if (!response.ok) throw new LearnerApiError(response.status, `요청이 실패했습니다 (${response.status})`)
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

// ---- wire format (snake_case) <-> app types (camelCase) ---------------------------------------

type WireMark = { marked_at: string; source: 'manual' | 'auto' }
type WireStats = { attempts: number; wrong: number; streak: number; last_wrong_at: string | null }
type WireReview = {
  box_level: number
  due_at: string
  last_confidence: ReviewState['lastConfidence']
  last_correct: boolean
  attempts: number
  overconfident_miss: boolean
}
type WireMiniTest = {
  id: string
  taken_at: string
  scope_label: string
  items: { question_id: string; selected_index: number; correct_indexes: number[]; is_correct: boolean }[]
}

const toMark = (m: WireMark): QuestionMark => ({ markedAt: m.marked_at, source: m.source })
const toStats = (s: WireStats): QuestionStats => ({
  attempts: s.attempts,
  wrong: s.wrong,
  streak: s.streak,
  lastWrongAt: s.last_wrong_at,
})
const toReview = (r: WireReview): ReviewState => ({
  boxLevel: r.box_level,
  dueAt: r.due_at,
  lastConfidence: r.last_confidence,
  lastCorrect: r.last_correct,
  attempts: r.attempts,
  overconfidentMiss: r.overconfident_miss,
})
const fromReview = (r: ReviewState): WireReview => ({
  box_level: r.boxLevel,
  due_at: r.dueAt,
  last_confidence: r.lastConfidence,
  last_correct: r.lastCorrect,
  attempts: r.attempts,
  overconfident_miss: r.overconfidentMiss,
})
const toMiniTest = (t: WireMiniTest): MiniTestRecord => ({
  id: t.id,
  takenAt: t.taken_at,
  scopeLabel: t.scope_label,
  items: t.items.map((i) => ({
    questionId: i.question_id,
    selectedIndex: i.selected_index,
    correctIndexes: i.correct_indexes,
    isCorrect: i.is_correct,
  })),
})
const mapValues = <A, B>(source: Record<string, A>, fn: (value: A) => B): Record<string, B> =>
  Object.fromEntries(Object.entries(source).map(([key, value]) => [key, fn(value)]))

// ---- endpoints --------------------------------------------------------------------------------

export async function fetchLearnerState(): Promise<{
  autoMarkStreak: number
  marks: QuestionMarkMap
  stats: QuestionStatsMap
  review: ReviewStateMap
}> {
  const raw = await learnerRequest<{
    auto_mark_streak: number
    marks: Record<string, WireMark>
    stats: Record<string, WireStats>
    review: Record<string, WireReview>
  }>('/state')
  return {
    autoMarkStreak: raw.auto_mark_streak,
    marks: mapValues(raw.marks, toMark),
    stats: mapValues(raw.stats, toStats),
    review: mapValues(raw.review, toReview),
  }
}

export async function fetchMiniTests(): Promise<MiniTestRecord[]> {
  return (await learnerRequest<WireMiniTest[]>('/mini-tests')).map(toMiniTest)
}

export async function putMark(questionId: string): Promise<QuestionMark> {
  return toMark(await learnerRequest<WireMark>(`/marks/${questionId}`, { method: 'PUT' }))
}

export async function deleteMark(questionId: string): Promise<QuestionStats | null> {
  const raw = await learnerRequest<{ stats: WireStats | null }>(`/marks/${questionId}`, { method: 'DELETE' })
  return raw.stats ? toStats(raw.stats) : null
}

export async function postAttempt(
  questionId: string,
  selectedIndex: number,
): Promise<{ check: AnswerCheckResponse; stats: QuestionStats; mark: QuestionMark | null; autoMarked: boolean }> {
  const raw = await learnerRequest<{
    check: AnswerCheckResponse
    stats: WireStats
    mark: WireMark | null
    auto_marked: boolean
  }>('/attempts', { method: 'POST', body: JSON.stringify({ question_id: questionId, selected_index: selectedIndex }) })
  return { check: raw.check, stats: toStats(raw.stats), mark: raw.mark ? toMark(raw.mark) : null, autoMarked: raw.auto_marked }
}

export function putReview(questionId: string, state: ReviewState): Promise<void> {
  return learnerRequest(`/review/${questionId}`, { method: 'PUT', body: JSON.stringify(fromReview(state)) })
}

export async function postMiniTest(
  scopeLabel: string,
  answers: { questionId: string; selectedIndex: number }[],
): Promise<{
  record: MiniTestRecord
  autoMarkedIds: string[]
  stats: QuestionStatsMap
  marks: QuestionMarkMap
}> {
  const raw = await learnerRequest<{
    record: WireMiniTest
    auto_marked_ids: string[]
    stats: Record<string, WireStats>
    marks: Record<string, WireMark>
  }>('/mini-tests', {
    method: 'POST',
    body: JSON.stringify({
      scope_label: scopeLabel,
      answers: answers.map((a) => ({ question_id: a.questionId, selected_index: a.selectedIndex })),
    }),
  })
  return {
    record: toMiniTest(raw.record),
    autoMarkedIds: raw.auto_marked_ids,
    stats: mapValues(raw.stats, toStats),
    marks: mapValues(raw.marks, toMark),
  }
}

/** Body for the one-time upload of pre-Postgres localStorage data. */
export type LocalImportPayload = {
  marks: Record<string, { marked_at: string; source?: 'manual' | 'auto' }>
  stats: Record<string, { attempts: number; wrong: number; streak?: number; last_wrong_at?: string | null }>
  review: Record<string, WireReview>
  mini_tests: WireMiniTest[]
}

export async function postLocalImport(payload: LocalImportPayload): Promise<boolean> {
  return (await learnerRequest<{ imported: boolean }>('/import', { method: 'POST', body: JSON.stringify(payload) })).imported
}
