import type { QuestionPublic } from '@/types/question.types'

export type OxAnswer = 'O' | 'X'

/** A statement served by the API; its verdict stays on the server. */
export type OxStatement = {
  question_id: string
  statement_index: number
  statement: string
  /** Choice to highlight in the full question; null when the statement is a 가/나/다 item or a blank. */
  choice_index: number | null
}

/** One statement of a question, played to mark O or X. */
export type OxItem = {
  key: string
  question: QuestionPublic
  statementIndex: number
  choiceIndex: number | null
  statement: string
}

export type OxCheckResponse = {
  question_id: string
  statement_index: number
  is_true: boolean
  is_correct: boolean
  /** Answer counts after this answer; null when the answer was not counted (signed out). */
  stats: { attempts: number; wrong: number; last_attempt_at: string } | null
}

export type OxResult = {
  answer: OxAnswer
  isTrue: boolean
  isCorrect: boolean
}

/** random: reshuffled on demand; order: the exam's question order, so a statement is easy to find again. */
export type OxSort = 'random' | 'order'

/** Whether the learner has answered a statement before. */
export type OxSolved = 'all' | 'solved' | 'unsolved'

export type OxFilter = {
  year: number | 'all'
  subject: string | 'all'
  query: string
  markedOnly: boolean
  wrongOnly: boolean
  solved: OxSolved
  sort: OxSort
}
