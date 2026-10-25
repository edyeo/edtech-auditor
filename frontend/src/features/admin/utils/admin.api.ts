import type { AdminQuestion } from '@/types/question.types'

export class AdminApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function adminRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
  })
  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: { detail?: unknown }) => (typeof body.detail === 'string' ? body.detail : null))
      .catch(() => null)
    throw new AdminApiError(response.status, detail ?? `요청이 실패했습니다 (${response.status})`)
  }
  return response.json() as Promise<T>
}

export function fetchAdminQuestions(token: string): Promise<AdminQuestion[]> {
  return adminRequest(token, '/questions')
}

export function updateAnswer(token: string, questionId: string, answerIndexes: number[]): Promise<AdminQuestion> {
  return adminRequest(token, `/questions/${questionId}/answer`, {
    method: 'PUT',
    body: JSON.stringify({ answer_indexes: answerIndexes }),
  })
}

export function resetAnswer(token: string, questionId: string): Promise<AdminQuestion> {
  return adminRequest(token, `/questions/${questionId}/answer`, { method: 'DELETE' })
}
