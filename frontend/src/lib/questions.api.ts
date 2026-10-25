import type {
  AnswerCheckResponse,
  ExplainResponse,
  QuestionPublic,
} from '@/types/question.types'

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`요청이 실패했습니다 (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function fetchQuestions(): Promise<QuestionPublic[]> {
  const response = await fetch('/api/questions')
  return parseJsonOrThrow(response)
}

export async function checkAnswer(
  questionId: string,
  selectedIndex: number,
): Promise<AnswerCheckResponse> {
  const response = await fetch('/api/questions/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId, selected_index: selectedIndex }),
  })
  return parseJsonOrThrow(response)
}

export async function explainAnswer(
  questionId: string,
  selectedIndex: number,
): Promise<ExplainResponse> {
  const response = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId, selected_index: selectedIndex }),
  })
  return parseJsonOrThrow(response)
}

export async function checkAnswersBatch(
  answers: { questionId: string; selectedIndex: number }[],
): Promise<AnswerCheckResponse[]> {
  const response = await fetch('/api/questions/check-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      answers: answers.map((a) => ({ question_id: a.questionId, selected_index: a.selectedIndex })),
    }),
  })
  return parseJsonOrThrow(response)
}
