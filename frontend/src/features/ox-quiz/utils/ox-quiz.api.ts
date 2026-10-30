import type { OxAnswer, OxCheckResponse, OxStatement } from '@/features/ox-quiz/types/ox-quiz.types'

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`요청이 실패했습니다 (${response.status})`)
  }
  return response.json() as Promise<T>
}

/** Every statement that can be played as O/X. */
export async function fetchOxStatements(): Promise<OxStatement[]> {
  return parseJsonOrThrow(await fetch('/api/ox/statements'))
}

export async function checkOxStatement(
  questionId: string,
  statementIndex: number,
  answer: OxAnswer,
): Promise<OxCheckResponse> {
  const response = await fetch('/api/ox/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId, statement_index: statementIndex, answer }),
  })
  return parseJsonOrThrow(response)
}
