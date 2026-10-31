import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type QuestionChoiceReadoutProps = {
  choices: string[]
  /** Choice to emphasise among the others; omit for a plain list. */
  highlightIndex?: number | null
  highlightLabel?: string
}

/** Every choice of a question as a read-only numbered list. */
export function QuestionChoiceReadout({ choices, highlightIndex = null, highlightLabel }: QuestionChoiceReadoutProps) {
  return (
    <ol className="flex flex-col gap-1.5">
      {choices.map((choice, index) => (
        <li
          key={index}
          className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-2 text-base md:text-sm',
            index === highlightIndex ? 'border-primary bg-accent' : 'border-border',
          )}
        >
          <span className="font-medium text-muted-foreground">{index + 1}.</span>
          <span className="min-w-0 flex-1">{choice || '그림 참고'}</span>
          {index === highlightIndex && highlightLabel && <Badge variant="secondary">{highlightLabel}</Badge>}
        </li>
      ))}
    </ol>
  )
}
