import { QuestionMarkButton } from '@/components/question-mark-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { MiniTestRecord } from '@/types/learner.types'
import { previewStem } from '@/lib/question-preview'
import type { QuestionPublic } from '@/types/question.types'

type MiniTestResultProps = {
  questions: QuestionPublic[]
  record: MiniTestRecord
  autoMarkedIds: string[]
  onRetry: () => void
}

export function MiniTestResult({ questions, record, autoMarkedIds, onRetry }: MiniTestResultProps) {
  const correctCount = record.items.filter((item) => item.isCorrect).length
  const wrongCount = record.items.length - correctCount

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>
          결과 {correctCount} / {record.items.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {record.scopeLabel} — 결과가 기록되었습니다.
          {wrongCount > 0 && ` 틀린 ${wrongCount}문항은 오답노트에 쌓였어요.`}
        </p>
        {autoMarkedIds.length > 0 && (
          <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            연속으로 틀린 {autoMarkedIds.length}문항이 자동으로 마킹되었습니다.
          </p>
        )}
        <ol className="flex flex-col">
          {record.items.map((item, i) => {
            const question = questions.find((q) => q.id === item.questionId)
            if (!question) return null
            return (
              <li key={item.questionId} className="flex items-start gap-1 border-b py-2 last:border-b-0">
                <QuestionMarkButton questionId={question.id} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    {i + 1}. {question.year}년 {question.round}회 {question.number}번 · {question.subject}
                  </span>
                  <a href={`#/practice/${question.id}`} className="line-clamp-2 text-sm hover:underline">
                    {previewStem(question)}
                  </a>
                  {!item.isCorrect && (
                    <span className="text-xs text-muted-foreground">
                      내 답 {item.selectedIndex + 1}번 → 정답 {item.correctIndexes.map((c) => `${c + 1}번`).join(', ')}
                    </span>
                  )}
                </div>
                <Badge variant={item.isCorrect ? 'secondary' : 'destructive'}>{item.isCorrect ? '정답' : '오답'}</Badge>
              </li>
            )
          })}
        </ol>
      </CardContent>
      <CardFooter className="flex justify-between gap-2">
        <Button variant="outline" onClick={onRetry}>
          다시 설정
        </Button>
        <Button asChild>
          <a href="#/wrong-notes">오답노트 보기</a>
        </Button>
      </CardFooter>
    </Card>
  )
}
