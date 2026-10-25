import type { ReviewState } from '@/types/learner.types'

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isDueForReview(state: ReviewState | undefined, today = todayIsoDate()): boolean {
  if (!state) return true
  return state.dueAt <= today
}
