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
import type { MiniTestRecord, ReviewState } from '@/types/learner.types'
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

/** Star button. Optimistic: the UI flips at once and rolls back if the server refuses. */
export async function toggleQuestionMark(questionId: string): Promise<void> {
  const before = learnerStore.getSnapshot()
  const wasMarked = questionId in before.marks

  if (wasMarked) {
    const { [questionId]: _removed, ...rest } = before.marks
    const stats = before.stats[questionId]
    learnerStore.update((s) => ({
      ...s,
      marks: rest,
      stats: stats ? { ...s.stats, [questionId]: { ...stats, streak: 0 } } : s.stats,
    }))
  } else {
    learnerStore.update((s) => ({
      ...s,
      marks: { ...s.marks, [questionId]: { markedAt: new Date().toISOString(), source: 'manual' } },
    }))
  }

  try {
    if (wasMarked) {
      const stats = await deleteMark(questionId)
      if (stats) learnerStore.update((s) => ({ ...s, stats: { ...s.stats, [questionId]: stats } }))
    } else {
      const mark = await putMark(questionId)
      learnerStore.update((s) => ({ ...s, marks: { ...s.marks, [questionId]: mark } }))
    }
  } catch {
    learnerStore.update((s) => ({ ...s, marks: before.marks, stats: before.stats }))
    notify('마킹을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
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
