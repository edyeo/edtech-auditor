import type { OxItem, OxStatement } from '@/features/ox-quiz/types/ox-quiz.types'
import type { QuestionPublic } from '@/types/question.types'

/** Pairs each served statement with its question; statements of unknown questions are dropped. */
export function buildOxItems(questions: QuestionPublic[], statements: OxStatement[]): OxItem[] {
  const byId = new Map(questions.map((question) => [question.id, question]))
  return statements.flatMap((statement) => {
    const question = byId.get(statement.question_id)
    if (!question) return []
    return [
      {
        key: `${statement.question_id}#${statement.statement_index}`,
        question,
        statementIndex: statement.statement_index,
        choiceIndex: statement.choice_index,
        statement: statement.statement,
      },
    ]
  })
}
