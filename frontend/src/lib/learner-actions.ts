import { importLocalLearnerDataOnce } from '@/lib/import-local-learner-data'
import {
  deleteMark,
  fetchLearnerState,
  fetchMiniTests,
  postAttempt,
  postMiniTest,
  putMark,
  putReview,
} from '@/lib/learner.api'
import { learnerStore } from '@/lib/learner-state.store'
import type {
  MiniTestRecord,
  QuestionMark,
  QuestionMarkMap,
  ReviewState,
} from '@/types/learner.types'
import type { AnswerCheckResponse } from '@/types/question.types'

function notify(message: string): void {
  learnerStore.update((state) => ({ ...state, notice: message }))
}

export function dismissLearnerNotice(): void {
  learnerStore.update((state) => ({ ...state, notice: null }))
}

let hydrating: Promise<void> | null = null

/** Load the learner's server-side data into the in-memory store (also retries after an error). */
export function hydrateLearnerState(): Promise<void> {
  // Callers racing (React StrictMode double effect, quick retry clicks) share one load.
  hydrating ??= loadLearnerState().finally(() => {
    hydrating = null
  })
  return hydrating
}

async function loadLearnerState(): Promise<void> {
  learnerStore.update((state) => ({ ...state, status: 'loading', error: null }))
  try {
    await importLocalLearnerDataOnce()
    const [state, history] = await Promise.all([fetchLearnerState(), fetchMiniTests()])
    learnerStore.update((current) => ({ ...current, ...state, history, status: 'ready', error: null }))
  } catch {
    learnerStore.update((state) => ({
      ...state,
      status: 'error',
      error: '학습 기록을 불러오지 못했습니다. 서버나 데이터베이스 연결을 확인해 주세요.',
    }))
  }
}

// Marker edits are sent as "set the count to N". Taps are coalesced per question: while a request is
// in flight only the latest wanted count is remembered and sent next, so quick taps cannot land out of
// order and an older response never overwrites a newer tap.
const wantedMarkCounts = new Map<string, number>()
const flushingMarks = new Set<string>()

/** Marker box +/- buttons. Optimistic: the UI changes at once and rolls back if the server refuses. */
export function setQuestionMarkCount(questionId: string, count: number): void {
  const before = learnerStore.getSnapshot()
  const next = Math.min(Math.max(count, 0), before.maxMarkCount)
  const current = before.marks[questionId]?.count ?? 0
  if (next === current && !flushingMarks.has(questionId)) return

  wantedMarkCounts.set(questionId, next)
  learnerStore.update((s) => ({ ...s, marks: withMarkCount(s.marks, questionId, next) }))
  void flushMarkCount(questionId, before.marks[questionId])
}

function withMarkCount(marks: QuestionMarkMap, questionId: string, count: number): QuestionMarkMap {
  if (count === 0) {
    const { [questionId]: _removed, ...rest } = marks
    return rest
  }
  const existing = marks[questionId]
  return {
    ...marks,
    [questionId]: existing
      ? { ...existing, count }
      : { markedAt: new Date().toISOString(), source: 'manual', count },
  }
}

async function flushMarkCount(questionId: string, confirmedMark: QuestionMark | undefined): Promise<void> {
  if (flushingMarks.has(questionId)) return
  flushingMarks.add(questionId)
  let confirmed = confirmedMark
  try {
    for (;;) {
      const wanted = wantedMarkCounts.get(questionId) ?? 0
      if (wanted === 0) {
        if (confirmed) {
          const stats = await deleteMark(questionId)
          if (stats) learnerStore.update((s) => ({ ...s, stats: { ...s.stats, [questionId]: stats } }))
        }
        confirmed = undefined
      } else if (wanted !== confirmed?.count) {
        confirmed = await putMark(questionId, wanted)
      }
      if ((wantedMarkCounts.get(questionId) ?? 0) === wanted) break
    }
    if (confirmed) {
      const mark = confirmed
      learnerStore.update((s) => ({ ...s, marks: { ...s.marks, [questionId]: mark } }))
    }
  } catch {
    learnerStore.update((s) => ({
      ...s,
      marks: confirmed
        ? { ...s.marks, [questionId]: confirmed }
        : withMarkCount(s.marks, questionId, 0),
    }))
    notify('마커를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  } finally {
    wantedMarkCounts.delete(questionId)
    flushingMarks.delete(questionId)
  }
}

/** Grade + record one answer on the server (updates stats and may auto-mark). Throws on failure. */
export async function submitAttempt(
  questionId: string,
  selectedIndex: number,
): Promise<{ check: AnswerCheckResponse; autoMarked: boolean }> {
  const result = await postAttempt(questionId, selectedIndex)
  learnerStore.update((s) => ({
    ...s,
    stats: { ...s.stats, [questionId]: result.stats },
    marks: result.mark ? { ...s.marks, [questionId]: result.mark } : s.marks,
  }))
  return { check: result.check, autoMarked: result.autoMarked }
}

/** Save a question's review box. Optimistic; a failed save only shows a notice. */
export async function saveReviewState(questionId: string, state: ReviewState): Promise<void> {
  learnerStore.update((s) => ({ ...s, review: { ...s.review, [questionId]: state } }))
  try {
    await putReview(questionId, state)
  } catch {
    notify('복습 일정을 저장하지 못했습니다. 이 문제의 복습 간격이 반영되지 않았을 수 있어요.')
  }
}

/** Grade + record a whole mini test on the server. Throws on failure (nothing is recorded then). */
export async function submitMiniTest(
  scopeLabel: string,
  answers: { questionId: string; selectedIndex: number }[],
): Promise<{ record: MiniTestRecord; autoMarkedIds: string[] }> {
  const result = await postMiniTest(scopeLabel, answers)
  learnerStore.update((s) => ({
    ...s,
    stats: { ...s.stats, ...result.stats },
    marks: { ...s.marks, ...result.marks },
    history: [result.record, ...s.history].slice(0, 100),
  }))
  return { record: result.record, autoMarkedIds: result.autoMarkedIds }
}
