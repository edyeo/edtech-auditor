import { cn } from 'cn'
import { ChoiceMarkerBox } from '@/components/choice-marker-box'
import { HighlightedText } from '@/components/highlighted-text'

type QuestionChoiceListProps = {
  choices: string[]
  selectedIndex: number | null
  correctIndex: number | null
  correctIndexes: number[]
  onSelect: (index: number) => void
  /** When given, every choice carries its own marker box beside it. */
  questionId?: string
}

export function QuestionChoiceList({
  choices,
  selectedIndex,
  correctIndex,
  correctIndexes,
  onSelect,
  questionId,
}: QuestionChoiceListProps) {
  const isChecked = correctIndex !== null

  return (
    <ul className="flex flex-col gap-2">
      {choices.map((choice, index) => {
        const isSelected = selectedIndex === index
        const isCorrectChoice = correctIndexes.includes(index)

        return (
          <li key={index} className="flex items-start gap-1">
            <button
              type="button"
              disabled={isChecked}
              aria-pressed={isSelected}
              // Dragging over the text to select a word also ends in a click; that must not pick the choice.
              onClick={() => {
                if (!window.getSelection()?.toString()) onSelect(index)
              }}
              className={cn(
                'flex min-w-0 flex-1 items-start gap-3 rounded-lg border px-4 py-3 text-left text-base transition-colors md:text-sm',
                'disabled:cursor-default',
                !isChecked && 'hover:bg-accent/50',
                // The picked choice is red before grading too (the same red as a wrong pick afterwards).
                !isChecked && isSelected && 'border-red-500 bg-red-500/10',
                !isChecked && !isSelected && 'border-border',
                isChecked && isCorrectChoice && 'border-emerald-500 bg-emerald-500/10',
                isChecked && isSelected && !isCorrectChoice && 'border-red-500 bg-red-500/10',
                isChecked && !isSelected && !isCorrectChoice && 'border-border opacity-60',
              )}
            >
              <span className="font-medium text-muted-foreground">{index + 1}.</span>
              <span data-term-source>{choice ? <HighlightedText text={choice} /> : '그림 참고'}</span>
            </button>
            {questionId && (
              <div className="shrink-0 pt-1">
                <ChoiceMarkerBox questionId={questionId} choiceIndex={index} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
