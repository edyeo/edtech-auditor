import { createStore } from '@/lib/create-store'

/** A highlighted word the learner tapped, with where to show its buttons (viewport coordinates). */
export type HighlightTarget = { term: string; anchor: { x: number; y: number } }

/** Set by a tap on a highlighted word, cleared by the buttons that react to it. */
export const highlightTargetStore = createStore<HighlightTarget | null>(null)
