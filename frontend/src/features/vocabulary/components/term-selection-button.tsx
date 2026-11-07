import { BookmarkPlus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTermSelection } from '@/features/vocabulary/utils/use-term-selection'
import { saveVocabularyTerm } from '@/lib/learner-actions'
import { useVocabulary } from '@/lib/use-vocabulary'

const BUTTON_WIDTH = 168
const EDGE_GAP = 8

/** Floats under the text the learner selected in a question, to save it to the vocabulary list. */
export function TermSelectionButton() {
  const selection = useTermSelection()
  const { has } = useVocabulary()
  if (!selection) return null

  const isSaved = has(selection.term)
  const left = Math.min(
    Math.max(selection.anchor.x - BUTTON_WIDTH / 2, EDGE_GAP),
    window.innerWidth - BUTTON_WIDTH - EDGE_GAP,
  )

  async function save() {
    if (!selection) return
    if (await saveVocabularyTerm(selection.term, selection.sourceQuestionId)) window.getSelection()?.removeAllRanges()
  }

  return (
    <div style={{ position: 'fixed', top: selection.anchor.y + 10, left, width: BUTTON_WIDTH }} className="z-50">
      {isSaved ? (
        <Button asChild size="sm" variant="secondary" className="h-10 w-full shadow-md md:h-8">
          <a href="#/vocabulary">
            <Check /> 단어장에 있음
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          className="h-10 w-full shadow-md md:h-8"
          // Keep the selection alive: a press on the button would otherwise clear it before the click.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void save()}
        >
          <BookmarkPlus /> 단어장에 저장
        </Button>
      )}
    </div>
  )
}
