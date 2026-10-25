import { useEffect, useSyncExternalStore } from 'react'
import { hydrateLearnerState } from '@/lib/learner-actions'
import { learnerStore } from '@/lib/learner-state.store'

/** Loads the learner's server data once on mount; returns the load status for gating the UI. */
export function useLearnerBootstrap() {
  const status = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().status)
  const error = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().error)

  useEffect(() => {
    void hydrateLearnerState()
  }, [])

  return { status, error, retry: hydrateLearnerState }
}
