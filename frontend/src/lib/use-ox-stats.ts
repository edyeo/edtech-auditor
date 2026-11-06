import { useSyncExternalStore } from 'react'
import { learnerStore } from '@/lib/learner-state.store'

/** How often the learner answered each O/X statement, keyed "question_id#statement_index". */
export function useOxStats() {
  return useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().oxStats)
}
