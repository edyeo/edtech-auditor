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
    <ul role="radiogroup" className="flex flex-col gap-2">
      {choices.map((choice, index) => {
        const isSelected = selectedIndex === index
        const isCorrectChoice = correctIndexes.includes(index)

        return (
          <li key={index} className="flex items-start gap-1">
            <button
              type="button"
              disabled={isChecked}
              role="radio"
              aria-checked={isSelected}
              // Dragging over the text to select a word also ends in a click; that must not pick the choice.
              onClick={() => {
                if (!window.getSelection()?.toString()) onSelect(index)
              }}
              className={cn(
                'flex min-w-0 flex-1 items-start gap-3 rounded-lg border px-4 py-3 text-left text-base transition-colors md:text-sm',
                'disabled:cursor-default',
                !isChecked && 'hover:bg-accent/50',
                // Before grading the row keeps its plain look; the radio in front shows the pick.
                !isChecked && 'border-border',
                isChecked && isCorrectChoice && 'border-emerald-500 bg-emerald-500/10',
                isChecked && isSelected && !isCorrectChoice && 'border-red-500 bg-red-500/10',
                isChecked && !isSelected && !isCorrectChoice && 'border-border opacity-60',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                  isSelected ? 'border-sky-700' : 'border-muted-foreground/50',
                )}
              >
                {isSelected && <span className="size-2 rounded-full bg-sky-700" />}
              </span>
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
