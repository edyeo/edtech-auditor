import { createStore } from '@/lib/create-store'
import type {
  MiniTestRecord,
  OxStatsMap,
  QuestionMarkMap,
  QuestionStatsMap,
  ReviewStateMap,
  VocabularyMap,
} from '@/types/learner.types'

export type LearnerStatus = 'loading' | 'ready' | 'error'

export type LearnerState = {
  status: LearnerStatus
  error: string | null
  /** Transient message for a failed background save (shown as a dismissible banner). */
  notice: string | null
  /** Server rule: this many wrong answers in a row flags a question in the lists. */
  autoMarkStreak: number
  /** Server rule: the most markers one question can carry. */
  maxMarkCount: number
  marks: QuestionMarkMap
  /** Markers on single O/X statements, keyed "question_id#statement_index"; separate from `marks`. */
  oxMarks: QuestionMarkMap
  /** Markers on single answer choices, keyed "question_id#choice_index"; separate from `marks` and `oxMarks`. */
  choiceMarks: QuestionMarkMap
  /** Words saved from the questions, highlighted wherever they appear. */
  vocabulary: VocabularyMap
  stats: QuestionStatsMap
  oxStats: OxStatsMap
  review: ReviewStateMap
  history: MiniTestRecord[]
}

export const INITIAL_LEARNER_STATE: LearnerState = {
  status: 'loading',
  error: null,
  notice: null,
  autoMarkStreak: 2,
  maxMarkCount: 5,
  marks: {},
  oxMarks: {},
  choiceMarks: {},
  vocabulary: {},
  stats: {},
  oxStats: {},
  review: {},
  history: [],
}

/** Server-owned learner data (marks, stats, review boxes, mini test history), kept in memory. */
export const learnerStore = createStore<LearnerState>(INITIAL_LEARNER_STATE)
