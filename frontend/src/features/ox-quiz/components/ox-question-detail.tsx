import { QuestionStem } from '@/components/question-stem'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { QuestionPublic } from '@/types/question.types'

type OxQuestionDetailProps = {
  id: string
  question: QuestionPublic
  /** The choice that is being played as a statement, highlighted among the full choice list; null if none. */
  choiceIndex: number | null
}

/** The whole original question: exam year, stem and every choice. */
export function OxQuestionDetail({ id, question, choiceIndex }: OxQuestionDetailProps) {
  return (
    <div id={id} className="mt-3 flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">
        {question.year}년 {question.round}회 {question.number}번 · {question.subject}
      </p>
      <QuestionStem stem={question.stem} imageUrl={question.image_url} />
      <ol className="flex flex-col gap-1.5">
        {question.choices.map((choice, index) => (
          <li
            key={index}
            className={cn(
              'flex items-start gap-2 rounded-md border px-3 py-2 text-base md:text-sm',
              index === choiceIndex ? 'border-primary bg-accent' : 'border-border',
            )}
          >
            <span className="font-medium text-muted-foreground">{index + 1}.</span>
            <span className="min-w-0 flex-1">{choice || '그림 참고'}</span>
            {index === choiceIndex && <Badge variant="secondary">이 보기</Badge>}
          </li>
        ))}
      </ol>
    </div>
  )
}
