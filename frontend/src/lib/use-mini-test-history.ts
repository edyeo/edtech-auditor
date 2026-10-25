import { useSyncExternalStore } from 'react'
import { learnerStore } from '@/lib/learner-state.store'

export function useMiniTestHistory() {
  return useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().history)
}
