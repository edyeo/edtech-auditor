export type MarkSource = 'manual' | 'auto'
export type QuestionMark = {
  markedAt: string
  source: MarkSource
  /** Markers on the question: one per wrong answer, adjustable by hand. */
  count: number
}
export type QuestionMarkMap = Record<string, QuestionMark>

export type QuestionStats = {
  attempts: number
  wrong: number
  /** Consecutive wrong answers since the last correct one. */
  streak: number
  lastWrongAt: string | null
}
export type QuestionStatsMap = Record<string, QuestionStats>

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export type ReviewState = {
  boxLevel: number
  dueAt: string // ISO date, yyyy-mm-dd
  lastConfidence: ConfidenceLevel
  lastCorrect: boolean
  attempts: number
  overconfidentMiss: boolean
}
export type ReviewStateMap = Record<string, ReviewState>

export type MiniTestResultItem = {
  questionId: string
  selectedIndex: number
  correctIndexes: number[]
  isCorrect: boolean
}

export type MiniTestRecord = {
  id: string
  takenAt: string
  scopeLabel: string
  items: MiniTestResultItem[]
}
