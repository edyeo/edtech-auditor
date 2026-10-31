import type { ConfidenceLevel, ReviewState } from '@/types/learner.types'

// Leitner-style expanding intervals (days), index = box level.
// Grounded in Cepeda et al. (2006): optimal spacing expands as retention strengthens.
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const
const MAX_BOX = INTERVAL_DAYS.length - 1

// A review state still stores a confidence level, but learners are no longer asked for one.
const NEUTRAL_CONFIDENCE: ConfidenceLevel = 'medium'

function addDaysAsIsoDate(date: Date, days: number): string {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

/**
 * Decide the next review box/date for a question after one attempt.
 *
 * - Wrong answer: reset to box 0 (due immediately).
 * - Correct answer: advance one box.
 */
export function computeNextReview(
  previous: ReviewState | undefined,
  isCorrect: boolean,
  now = new Date(),
): ReviewState {
  const previousBox = previous?.boxLevel ?? 0
  const nextBox = isCorrect ? Math.min(previousBox + 1, MAX_BOX) : 0

  return {
    boxLevel: nextBox,
    dueAt: addDaysAsIsoDate(now, INTERVAL_DAYS[nextBox]),
    lastConfidence: NEUTRAL_CONFIDENCE,
    lastCorrect: isCorrect,
    attempts: (previous?.attempts ?? 0) + 1,
    overconfidentMiss: false,
  }
}

export function intervalDaysForBox(boxLevel: number): number {
  return INTERVAL_DAYS[Math.min(Math.max(boxLevel, 0), MAX_BOX)]
}
