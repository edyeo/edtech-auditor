import { useMemo, useSyncExternalStore } from 'react'
import { setQuestionMarkCount } from '@/lib/learner-actions'
import { learnerStore } from '@/lib/learner-state.store'

/** The learner's "오답 마커": several per question, added by wrong answers or by hand. */
export function useQuestionMarks() {
  const marks = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().marks)
  const maxMarkCount = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().maxMarkCount)
  const markedIds = useMemo(() => Object.keys(marks), [marks])

  return {
    marks,
    markedIds,
    maxMarkCount,
    markCount: (questionId: string) => marks[questionId]?.count ?? 0,
    isMarked: (questionId: string) => questionId in marks,
    setMarkCount: setQuestionMarkCount,
  }
}
