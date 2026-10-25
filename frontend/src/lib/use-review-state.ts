import { useSyncExternalStore } from 'react'
import { learnerStore } from '@/lib/learner-state.store'

export function useReviewState() {
  return useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().review)
}
