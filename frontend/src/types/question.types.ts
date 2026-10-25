export type QuestionPublic = {
  id: string
  year: number
  round: number
  number: number
  subject: string
  stem: string
  choices: string[]
  image_url: string | null
  source: string | null
}

export type AnswerCheckResponse = {
  question_id: string
  selected_index: number
  correct_index: number
  correct_indexes: number[]
  is_correct: boolean
}

export type ExplainResponse = {
  question_id: string
  explanation: string
}

export type AdminQuestion = QuestionPublic & {
  answer_index: number
  also_correct: number[]
  answer_overridden: boolean
}
