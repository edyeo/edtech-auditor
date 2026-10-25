import type { ConfidenceLevel, ReviewState } from '@/types/learner.types'

// Leitner-style expanding intervals (days), index = box level.
// Grounded in Cepeda et al. (2006): optimal spacing expands as retention strengthens.
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const
const MAX_BOX = INTERVAL_DAYS.length - 1

function addDaysAsIsoDate(date: Date, days: number): string {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

/**
 * Decide the next review box/date for a question after one attempt.
 *
 * - Wrong answer: reset to box 0 (due immediately) regardless of confidence.
 * - Correct + high confidence: skip ahead two boxes — genuinely secure knowledge
 *   needs less frequent review.
 * - Correct + low/medium confidence: advance one box — it stuck, but a lucky
 *   guess or shaky recall still needs a closer follow-up.
 * - Wrong + high confidence is flagged as an "overconfident miss" so the UI can
 *   call it out — these are the items most likely to feel known but aren't.
 */
export function computeNextReview(
  previous: ReviewState | undefined,
  isCorrect: boolean,
  confidence: ConfidenceLevel,
  now = new Date(),
): ReviewState {
  const previousBox = previous?.boxLevel ?? 0
  const overconfidentMiss = !isCorrect && confidence === 'high'

  let nextBox: number
  if (!isCorrect) {
    nextBox = 0
  } else if (confidence === 'high') {
    nextBox = Math.min(previousBox + 2, MAX_BOX)
  } else {
    nextBox = Math.min(previousBox + 1, MAX_BOX)
  }

  return {
    boxLevel: nextBox,
    dueAt: addDaysAsIsoDate(now, INTERVAL_DAYS[nextBox]),
    lastConfidence: confidence,
    lastCorrect: isCorrect,
    attempts: (previous?.attempts ?? 0) + 1,
    overconfidentMiss,
  }
}

export function intervalDaysForBox(boxLevel: number): number {
  return INTERVAL_DAYS[Math.min(Math.max(boxLevel, 0), MAX_BOX)]
}
