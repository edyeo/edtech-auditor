import { useSyncExternalStore } from 'react'
import { learnerStore } from '@/lib/learner-state.store'
import type { VocabularyMap } from '@/types/learner.types'

const patterns = new WeakMap<VocabularyMap, RegExp | null>()

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** One pattern for every saved word (longest first, any run of whitespace matches a space); null with no words. */
function buildPattern(vocabulary: VocabularyMap): RegExp | null {
  const terms = Object.values(vocabulary)
    .map((entry) => entry.term)
    .sort((a, b) => b.length - a.length)
  if (terms.length === 0) return null
  return new RegExp(`(${terms.map((term) => escapeRegExp(term).replace(/ /g, '\\s+')).join('|')})`, 'giu')
}

/** The pattern that finds the learner's saved words in a text; built once per change of the word list. */
export function useHighlightPattern(): RegExp | null {
  const vocabulary = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().vocabulary)
  if (!patterns.has(vocabulary)) patterns.set(vocabulary, buildPattern(vocabulary))
  return patterns.get(vocabulary) ?? null
}
