import { createStore } from '@/lib/create-store'
import type {
  MiniTestRecord,
  QuestionMarkMap,
  QuestionStatsMap,
  ReviewStateMap,
} from '@/types/learner.types'

export type LearnerStatus = 'loading' | 'ready' | 'error'

export type LearnerState = {
  status: LearnerStatus
  error: string | null
  /** Transient message for a failed background save (shown as a dismissible banner). */
  notice: string | null
  /** Server rule: this many wrong answers in a row auto-marks a question. */
  autoMarkStreak: number
  marks: QuestionMarkMap
  stats: QuestionStatsMap
  review: ReviewStateMap
  history: MiniTestRecord[]
}

/** Server-owned learner data (marks, stats, review boxes, mini test history), kept in memory. */
export const learnerStore = createStore<LearnerState>({
  status: 'loading',
  error: null,
  notice: null,
  autoMarkStreak: 2,
  marks: {},
  stats: {},
  review: {},
  history: [],
})
