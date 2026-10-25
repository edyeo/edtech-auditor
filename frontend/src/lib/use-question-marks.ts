import { useMemo, useSyncExternalStore } from 'react'
import { toggleQuestionMark } from '@/lib/learner-actions'
import { learnerStore } from '@/lib/learner-state.store'

/** The learner's "오답 체크" marks — set with the star, or automatically after repeated wrong answers. */
export function useQuestionMarks() {
  const marks = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().marks)
  const markedIds = useMemo(() => Object.keys(marks), [marks])

  return {
    marks,
    markedIds,
    isMarked: (questionId: string) => questionId in marks,
    toggleMark: toggleQuestionMark,
  }
}
