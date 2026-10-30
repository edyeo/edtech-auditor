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
}

export type OxResult = {
  answer: OxAnswer
  isTrue: boolean
  isCorrect: boolean
}

export type OxFilter = {
  year: number | 'all'
  subject: string | 'all'
  query: string
}
