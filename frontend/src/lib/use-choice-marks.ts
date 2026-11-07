import { useSyncExternalStore } from 'react'
import { setChoiceMarkCount } from '@/lib/learner-actions'
import { learnerStore } from '@/lib/learner-state.store'

/** The learner's markers on single answer choices (keyed "question_id#choice_index"). */
export function useChoiceMarks() {
  const choiceMarks = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().choiceMarks)
  const maxMarkCount = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().maxMarkCount)

  return {
    maxMarkCount,
    markCount: (choiceKey: string) => choiceMarks[choiceKey]?.count ?? 0,
    setMarkCount: setChoiceMarkCount,
  }
}
