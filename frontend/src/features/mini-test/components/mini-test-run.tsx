import { useState } from 'react'
import { QuestionChoiceList } from '@/components/question-choice-list'
import { QuestionStem } from '@/components/question-stem'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { QuestionPublic } from '@/types/question.types'

type MiniTestRunProps = {
  questions: QuestionPublic[]
  isSubmitting: boolean
  error: string | null
  onSubmit: (answers: Record<string, number>) => void
}

export function MiniTestRun({ questions, isSubmitting, error, onSubmit }: MiniTestRunProps) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})

  const question = questions[index]
  const answeredCount = Object.keys(answers).length
  const remaining = questions.length - answeredCount

  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          미니 테스트 · {index + 1} / {questions.length}
        </CardTitle>
        <Badge variant="secondary">{answeredCount}문항 답변</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <nav aria-label="문항 이동" className="flex flex-wrap gap-1">
          {questions.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={`${i + 1}번 문항${item.id in answers ? ' (답변함)' : ''}`}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => setIndex(i)}
              className={cn(
                'size-10 rounded-md border text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:size-7 md:text-xs',
                i === index && 'border-primary',
                item.id in answers ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground',
              )}
            >
              {i + 1}
            </button>
          ))}
        </nav>

        <p className="text-xs text-muted-foreground">
          {question.year}년 {question.round}회 {question.number}번 · {question.subject}
        </p>
        <QuestionStem stem={question.stem} imageUrl={question.image_url} />
        <QuestionChoiceList
          choices={question.choices}
          selectedIndex={answers[question.id] ?? null}
          correctIndex={null}
          correctIndexes={[]}
          onSelect={(choice) => setAnswers((current) => ({ ...current, [question.id]: choice }))}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 md:h-8" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            이전
          </Button>
          <Button
            variant="outline"
            className="h-11 md:h-8"
            disabled={index === questions.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            다음
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {remaining > 0 && <span className="text-xs text-muted-foreground">{remaining}문항 남음</span>}
          <Button className="h-11 md:h-8" disabled={remaining > 0 || isSubmitting} onClick={() => onSubmit(answers)}>
            {isSubmitting ? '채점 중...' : '제출'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
