import { useMemo, useSyncExternalStore } from 'react'
import { learnerStore } from '@/lib/learner-state.store'
import { termKey } from '@/lib/vocabulary-term'

/** The words the learner saved, newest first. */
export function useVocabulary() {
  const vocabulary = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().vocabulary)
  const terms = useMemo(
    () => Object.values(vocabulary).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [vocabulary],
  )

  return { terms, has: (term: string) => termKey(term) in vocabulary }
}
