import { useSyncExternalStore } from 'react'
import { learnerStore } from '@/lib/learner-state.store'

export function useQuestionStats() {
  return useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().stats)
}

export function useAutoMarkStreak() {
  return useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().autoMarkStreak)
}
