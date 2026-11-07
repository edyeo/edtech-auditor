import { BookmarkMinus, BookmarkPlus, Check } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { useTermSelection } from '@/features/vocabulary/utils/use-term-selection'
import { highlightTargetStore } from '@/lib/highlight-target.store'
import { saveVocabularyTerm, updateVocabularyTerm } from '@/lib/learner-actions'
import { useVocabulary } from '@/lib/use-vocabulary'

const BUTTON_WIDTH = 236
const EDGE_GAP = 8

/**
 * Floats under a word in a question: the text the learner selected (to save it) or a highlighted word they tapped
 * (to switch it off). Switching off keeps the note; saving the word again switches it back on.
 */
export function TermSelectionButton() {
  const selection = useTermSelection()
  const tapped = useSyncExternalStore(highlightTargetStore.subscribe, highlightTargetStore.getSnapshot)
  const { find } = useVocabulary()

  // A tap anywhere but on the buttons or on a highlighted word closes the tapped word's buttons.
  useEffect(() => {
    if (!tapped) return
    const close = () => highlightTargetStore.set(null)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target?.closest('[data-term-popover], [data-term-mark]')) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [tapped])

  const subject = selection ?? (tapped ? { term: tapped.term, sourceQuestionId: null, anchor: tapped.anchor } : null)
  if (!subject) return null

  const saved = find(subject.term)
  const left = Math.min(
    Math.max(subject.anchor.x - BUTTON_WIDTH / 2, EDGE_GAP),
    window.innerWidth - BUTTON_WIDTH - EDGE_GAP,
  )

  function done() {
    highlightTargetStore.set(null)
    window.getSelection()?.removeAllRanges()
  }

  function switchOff() {
    if (!saved) return
    void updateVocabularyTerm(saved.term, { active: false })
    done()
  }

  async function save() {
    // The server switches a word that is already in the list (but off) back on and keeps its note.
    if (await saveVocabularyTerm(subject!.term, subject!.sourceQuestionId)) done()
  }

  // Keep the text selection alive: a press on a button would otherwise clear it before the click.
  const keepSelection = (event: React.MouseEvent) => event.preventDefault()

  return (
    <div data-term-popover style={{ position: 'fixed', top: subject.anchor.y + 10, left, width: BUTTON_WIDTH }} className="z-50">
      {saved?.active ? (
        <div className="flex gap-1">
          <Button asChild size="sm" variant="secondary" className="h-10 flex-1 shadow-md md:h-8">
            <a href="#/vocabulary">
              <Check /> 단어장 보기
            </a>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-10 flex-1 shadow-md md:h-8"
            onMouseDown={keepSelection}
            onClick={switchOff}
          >
            <BookmarkMinus /> 저장 해제
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          className="h-10 w-full shadow-md md:h-8"
          onMouseDown={keepSelection}
          onClick={() => void save()}
        >
          <BookmarkPlus /> {saved ? '다시 저장 (이전 노트 복원)' : '단어장에 저장'}
        </Button>
      )}
    </div>
  )
}
