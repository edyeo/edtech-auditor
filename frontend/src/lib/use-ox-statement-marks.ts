import { useMemo, useSyncExternalStore } from 'react'
import { setOxStatementMarkCount } from '@/lib/learner-actions'
import { learnerStore } from '@/lib/learner-state.store'

/** The learner's markers on single O/X statements (keyed "question_id#statement_index"), apart from the question's. */
export function useOxStatementMarks() {
  const oxMarks = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().oxMarks)
  const maxMarkCount = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().maxMarkCount)
  const markedKeys = useMemo(() => Object.keys(oxMarks), [oxMarks])

  return {
    markedKeys,
    maxMarkCount,
    markCount: (statementKey: string) => oxMarks[statementKey]?.count ?? 0,
    setMarkCount: setOxStatementMarkCount,
  }
}
