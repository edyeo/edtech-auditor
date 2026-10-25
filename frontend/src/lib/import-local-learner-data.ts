import { LearnerApiError, postLocalImport, type LocalImportPayload } from '@/lib/learner.api'

// Where the app kept learner data before it moved to Postgres.
const LEGACY_KEYS = {
  marks: 'question-marks-v1',
  stats: 'question-stats-v1',
  review: 'exam-review-state-v1',
  history: 'mini-test-history-v1',
} as const
const DONE_FLAG = 'learner-imported-v1'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/**
 * One-time, best-effort upload of this browser's old localStorage data so nothing is lost in the
 * move to Postgres. The server only accepts it into an empty profile, so it can't overwrite data.
 * Leaves the old keys in place (harmless; lets the user roll back).
 */
export async function importLocalLearnerDataOnce(): Promise<void> {
  try {
    if (localStorage.getItem(DONE_FLAG)) return
  } catch {
    return
  }

  const marks = readJson<Record<string, { markedAt: string; source?: 'manual' | 'auto' }>>(LEGACY_KEYS.marks, {})
  const stats = readJson<Record<string, { attempts: number; wrong: number; streak?: number; lastWrongAt?: string }>>(LEGACY_KEYS.stats, {})
  const review = readJson<Record<string, Record<string, unknown>>>(LEGACY_KEYS.review, {})
  const history = readJson<
    { takenAt: string; scopeLabel: string; items: { questionId: string; selectedIndex: number; correctIndexes: number[]; isCorrect: boolean }[] }[]
  >(LEGACY_KEYS.history, [])

  const hasData = [marks, stats, review].some((value) => Object.keys(value).length > 0) || history.length > 0
  if (hasData) {
    const payload: LocalImportPayload = {
      marks: Object.fromEntries(Object.entries(marks).map(([id, m]) => [id, { marked_at: m.markedAt, source: m.source }])),
      stats: Object.fromEntries(
        Object.entries(stats).map(([id, s]) => [
          id,
          { attempts: s.attempts, wrong: s.wrong, streak: s.streak, last_wrong_at: s.lastWrongAt ?? null },
        ]),
      ),
      review: Object.fromEntries(
        Object.entries(review).map(([id, r]) => [
          id,
          {
            box_level: r.boxLevel,
            due_at: r.dueAt,
            last_confidence: r.lastConfidence,
            last_correct: r.lastCorrect,
            attempts: r.attempts,
            overconfident_miss: r.overconfidentMiss,
          },
        ]),
      ) as LocalImportPayload['review'],
      mini_tests: history.map((t, index) => ({
        id: `legacy-${index}`,
        taken_at: t.takenAt,
        scope_label: t.scopeLabel,
        items: t.items.map((i) => ({
          question_id: i.questionId,
          selected_index: i.selectedIndex,
          correct_indexes: i.correctIndexes,
          is_correct: i.isCorrect,
        })),
      })),
    }
    try {
      await postLocalImport(payload)
    } catch (error) {
      // A 4xx means this legacy data is unusable - don't retry forever. Anything else (server or
      // network trouble) is retried on the next load.
      if (!(error instanceof LearnerApiError && error.status >= 400 && error.status < 500)) throw error
    }
  }

  try {
    localStorage.setItem(DONE_FLAG, new Date().toISOString())
  } catch {
    // Can't persist the flag; the server-side "empty profile only" rule keeps a re-import harmless.
  }
}
