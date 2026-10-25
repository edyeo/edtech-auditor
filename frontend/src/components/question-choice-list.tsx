import { cn } from 'cn'

type QuestionChoiceListProps = {
  choices: string[]
  selectedIndex: number | null
  correctIndex: number | null
  correctIndexes: number[]
  onSelect: (index: number) => void
}

export function QuestionChoiceList({
  choices,
  selectedIndex,
  correctIndex,
  correctIndexes,
  onSelect,
}: QuestionChoiceListProps) {
  const isChecked = correctIndex !== null

  return (
    <ul className="flex flex-col gap-2">
      {choices.map((choice, index) => {
        const isSelected = selectedIndex === index
        const isCorrectChoice = correctIndexes.includes(index)

        return (
          <li key={index}>
            <button
              type="button"
              disabled={isChecked}
              onClick={() => onSelect(index)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                'disabled:cursor-default',
                !isChecked && 'hover:bg-accent/50',
                !isChecked && isSelected && 'border-primary bg-accent',
                !isChecked && !isSelected && 'border-border',
                isChecked && isCorrectChoice && 'border-emerald-500 bg-emerald-500/10',
                isChecked && isSelected && !isCorrectChoice && 'border-red-500 bg-red-500/10',
                isChecked && !isSelected && !isCorrectChoice && 'border-border opacity-60',
              )}
            >
              <span className="font-medium text-muted-foreground">{index + 1}.</span>
              <span>{choice || '그림 참고'}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
