import { clearSession, getAccessToken } from '@/lib/auth-token'
import type {
  MiniTestRecord,
  OxStats,
  OxStatsMap,
  QuestionMark,
  QuestionMarkMap,
  QuestionStats,
  QuestionStatsMap,
  ReviewState,
  ReviewStateMap,
  VocabularyImage,
  VocabularyMap,
  VocabularyTerm,
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
  const token = await getAccessToken()
  if (!token) throw new LearnerApiError(401, '로그인이 필요합니다')
  const response = await fetch(`/api/learner${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  if (response.status === 401) {
    // The server no longer accepts this session (revoked or expired for good): back to the login page.
    await clearSession()
    throw new LearnerApiError(401, '로그인이 만료되었습니다')
  }
  if (!response.ok) throw new LearnerApiError(response.status, `요청이 실패했습니다 (${response.status})`)
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

// ---- wire format (snake_case) <-> app types (camelCase) ---------------------------------------

type WireMark = { marked_at: string; source: 'manual' | 'auto'; count: number }
type WireImage = { id: string; content_type: string; size: number }
type WireTerm = {
  term: string
  memo: string
  studied: boolean
  active: boolean
  source_question_id: string | null
  section: string | null
  images: WireImage[]
  created_at: string
  updated_at: string
}
type WireOxStats = { attempts: number; wrong: number; last_attempt_at: string }
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

const toMark = (m: WireMark): QuestionMark => ({ markedAt: m.marked_at, source: m.source, count: m.count })
export const toOxStats = (s: WireOxStats): OxStats => ({
  attempts: s.attempts,
  wrong: s.wrong,
  lastAttemptAt: s.last_attempt_at,
})
const toImage = (i: WireImage): VocabularyImage => ({ id: i.id, contentType: i.content_type, size: i.size })
const toTerm = (t: WireTerm): VocabularyTerm => ({
  term: t.term,
  memo: t.memo,
  studied: t.studied,
  active: t.active,
  sourceQuestionId: t.source_question_id,
  section: t.section,
  images: t.images.map(toImage),
  createdAt: t.created_at,
  updatedAt: t.updated_at,
})
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
  maxMarkCount: number
  marks: QuestionMarkMap
  oxMarks: QuestionMarkMap
  choiceMarks: QuestionMarkMap
  vocabulary: VocabularyMap
  stats: QuestionStatsMap
  oxStats: OxStatsMap
  review: ReviewStateMap
}> {
  const raw = await learnerRequest<{
    auto_mark_streak: number
    max_mark_count: number
    marks: Record<string, WireMark>
    ox_marks: Record<string, WireMark>
    choice_marks: Record<string, WireMark>
    vocabulary: Record<string, WireTerm>
    stats: Record<string, WireStats>
    ox_stats: Record<string, WireOxStats>
    review: Record<string, WireReview>
  }>('/state')
  return {
    autoMarkStreak: raw.auto_mark_streak,
    maxMarkCount: raw.max_mark_count,
    marks: mapValues(raw.marks, toMark),
    oxMarks: mapValues(raw.ox_marks, toMark),
    choiceMarks: mapValues(raw.choice_marks, toMark),
    vocabulary: mapValues(raw.vocabulary, toTerm),
    stats: mapValues(raw.stats, toStats),
    oxStats: mapValues(raw.ox_stats, toOxStats),
    review: mapValues(raw.review, toReview),
  }
}

export async function fetchMiniTests(): Promise<MiniTestRecord[]> {
  return (await learnerRequest<WireMiniTest[]>('/mini-tests')).map(toMiniTest)
}

/** Set how many markers the question carries (1 and up); removing them all is `deleteMark`. */
export async function putMark(questionId: string, count: number): Promise<QuestionMark> {
  return toMark(
    await learnerRequest<WireMark>(`/marks/${questionId}`, { method: 'PUT', body: JSON.stringify({ count }) }),
  )
}

export async function deleteMark(questionId: string): Promise<QuestionStats | null> {
  const raw = await learnerRequest<{ stats: WireStats | null }>(`/marks/${questionId}`, { method: 'DELETE' })
  return raw.stats ? toStats(raw.stats) : null
}

/** "question_id#statement_index" -> the path of that statement's marker endpoint. */
function oxMarkPath(statementKey: string): string {
  const [questionId, statementIndex] = statementKey.split('#')
  return `/ox-marks/${questionId}/${statementIndex}`
}

/** Set how many markers one O/X statement carries (1 and up); removing them all is `deleteOxMark`. */
export async function putOxMark(statementKey: string, count: number): Promise<QuestionMark> {
  return toMark(
    await learnerRequest<WireMark>(oxMarkPath(statementKey), { method: 'PUT', body: JSON.stringify({ count }) }),
  )
}

/** "question_id#choice_index" -> the path of that choice's marker endpoint. */
function choiceMarkPath(choiceKey: string): string {
  const [questionId, choiceIndex] = choiceKey.split('#')
  return `/choice-marks/${questionId}/${choiceIndex}`
}

/** Set how many markers one answer choice carries (1 and up); removing them all is `deleteChoiceMark`. */
export async function putChoiceMark(choiceKey: string, count: number): Promise<QuestionMark> {
  return toMark(
    await learnerRequest<WireMark>(choiceMarkPath(choiceKey), { method: 'PUT', body: JSON.stringify({ count }) }),
  )
}

export function deleteChoiceMark(choiceKey: string): Promise<void> {
  return learnerRequest(choiceMarkPath(choiceKey), { method: 'DELETE' })
}

export function deleteOxMark(statementKey: string): Promise<void> {
  return learnerRequest(oxMarkPath(statementKey), { method: 'DELETE' })
}

/** Save a selected word; saving a word that already exists returns it unchanged. */
export async function postVocabularyTerm(
  term: string,
  sourceQuestionId: string | null,
  section: string | null = null,
): Promise<VocabularyTerm> {
  return toTerm(
    await learnerRequest<WireTerm>('/vocabulary', {
      method: 'POST',
      body: JSON.stringify({ term, source_question_id: sourceQuestionId, section }),
    }),
  )
}

export async function patchVocabularyTerm(
  term: string,
  change: { memo?: string; studied?: boolean; active?: boolean; section?: string },
): Promise<VocabularyTerm> {
  return toTerm(
    await learnerRequest<WireTerm>('/vocabulary', { method: 'PATCH', body: JSON.stringify({ term, ...change }) }),
  )
}

export function deleteVocabularyTerm(term: string): Promise<void> {
  return learnerRequest(`/vocabulary?term=${encodeURIComponent(term)}`, { method: 'DELETE' })
}

/** Upload a (compressed) picture for a note; the body is the raw image, so this skips the JSON helper. */
export async function postVocabularyImage(term: string, image: Blob): Promise<VocabularyImage> {
  const token = await getAccessToken()
  if (!token) throw new LearnerApiError(401, '로그인이 필요합니다')
  const response = await fetch(`/api/learner/vocabulary/images?term=${encodeURIComponent(term)}`, {
    method: 'POST',
    headers: { 'Content-Type': image.type, Authorization: `Bearer ${token}` },
    body: image,
  })
  if (!response.ok) throw new LearnerApiError(response.status, `요청이 실패했습니다 (${response.status})`)
  return toImage((await response.json()) as WireImage)
}

/** The picture's bytes; the endpoint needs the bearer token, so an <img src> cannot load it directly. */
export async function fetchVocabularyImage(imageId: string): Promise<Blob> {
  const token = await getAccessToken()
  if (!token) throw new LearnerApiError(401, '로그인이 필요합니다')
  const response = await fetch(`/api/learner/vocabulary/images/${imageId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new LearnerApiError(response.status, `요청이 실패했습니다 (${response.status})`)
  return response.blob()
}

export function deleteVocabularyImage(imageId: string): Promise<void> {
  return learnerRequest(`/vocabulary/images/${imageId}`, { method: 'DELETE' })
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
