import { useEffect, useState } from 'react'
import { isSavableTerm, normalizeTerm } from '@/lib/vocabulary-term'

export type TermSelection = {
  term: string
  /** The question the selected text belongs to, when its container says so. */
  sourceQuestionId: string | null
  /** Viewport position of the selection's last line, for placing the button. */
  anchor: { x: number; y: number }
}

function elementOf(node: Node | null): Element | null {
  return node instanceof Element ? node : (node?.parentElement ?? null)
}

function readSelection(): TermSelection | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  // Only text inside one question text block (stem, choice, statement, explanation) can be saved.
  const container = elementOf(range.commonAncestorContainer)?.closest('[data-term-source]')
  if (!container) return null

  const term = normalizeTerm(selection.toString())
  if (!isSavableTerm(term)) return null

  const rects = range.getClientRects()
  const last = rects[rects.length - 1] ?? range.getBoundingClientRect()
  return {
    term,
    sourceQuestionId: container.closest('[data-question-id]')?.getAttribute('data-question-id') ?? null,
    anchor: { x: last.left + last.width / 2, y: last.bottom },
  }
}

/** The saveable text the learner currently has selected, or null. */
export function useTermSelection(): TermSelection | null {
  const [selection, setSelection] = useState<TermSelection | null>(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setSelection(readSelection()))
    }
    document.addEventListener('selectionchange', update)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [])

  return selection
}
