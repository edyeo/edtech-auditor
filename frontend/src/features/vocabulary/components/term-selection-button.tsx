import { BookmarkMinus, BookmarkPlus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTermSelection } from '@/features/vocabulary/utils/use-term-selection'
import { removeVocabularyTerm, saveVocabularyTerm } from '@/lib/learner-actions'
import { useVocabulary } from '@/lib/use-vocabulary'

const BUTTON_WIDTH = 236
const EDGE_GAP = 8

/** Floats under the text the learner selected in a question, to save it to the vocabulary list. */
export function TermSelectionButton() {
  const selection = useTermSelection()
  const { find } = useVocabulary()
  if (!selection) return null

  const saved = find(selection.term)
  const left = Math.min(
    Math.max(selection.anchor.x - BUTTON_WIDTH / 2, EDGE_GAP),
    window.innerWidth - BUTTON_WIDTH - EDGE_GAP,
  )

  function unsave() {
    if (!selection || !saved) return
    // A note with content (memo or pictures) is not dropped by one stray tap.
    const hasContent = saved.memo !== '' || saved.images.length > 0
    if (hasContent && !window.confirm(`"${saved.term}" 노트에 적어 둔 내용도 함께 지워집니다. 단어장에서 뺄까요?`)) return
    void removeVocabularyTerm(saved.term)
    window.getSelection()?.removeAllRanges()
  }

  async function save() {
    if (!selection) return
    if (await saveVocabularyTerm(selection.term, selection.sourceQuestionId)) window.getSelection()?.removeAllRanges()
  }

  return (
    <div style={{ position: 'fixed', top: selection.anchor.y + 10, left, width: BUTTON_WIDTH }} className="z-50">
      {saved ? (
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
            onMouseDown={(event) => event.preventDefault()}
            onClick={unsave}
          >
            <BookmarkMinus /> 저장 해제
          </Button>
        </div>
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
