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

/** How often an O/X statement was answered, and how often wrongly. */
export type OxStats = { attempts: number; wrong: number; lastAttemptAt: string }
/** Keyed "question_id#statement_index". */
export type OxStatsMap = Record<string, OxStats>

export type VocabularyImage = { id: string; contentType: string; size: number }

/** A word the learner saved from the questions (or wrote by hand) to study later: a small concept note. */
export type VocabularyTerm = {
  term: string
  /** The note, written in Markdown. */
  memo: string
  studied: boolean
  /** The question the word was first selected in. */
  sourceQuestionId: string | null
  /** Subject the note was filed under by hand; null means "the section of the source question". */
  section: string | null
  images: VocabularyImage[]
  createdAt: string
  updatedAt: string
}
/** Keyed by the lower-cased term (see `termKey`). */
export type VocabularyMap = Record<string, VocabularyTerm>

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
