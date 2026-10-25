import { useMemo } from 'react'
import { QuestionListRow } from '@/components/question-list-row'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { previewStem } from '@/lib/question-preview'
import { useMiniTestHistory } from '@/lib/use-mini-test-history'
import { useQuestionBank } from '@/lib/use-question-bank'
import { useQuestionMarks } from '@/lib/use-question-marks'
import { useQuestionStats } from '@/lib/use-question-stats'

function formatTakenAt(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}

/** 오답노트: every question answered wrong at least once (study or mini test), most-missed first. */
export function WrongNotesPage() {
  const { questions, isLoading, error } = useQuestionBank()
  const { marks } = useQuestionMarks()
  const stats = useQuestionStats()
  const history = useMiniTestHistory()

  const wrongQuestions = useMemo(
    () =>
      questions
        .filter((question) => (stats[question.id]?.wrong ?? 0) > 0)
        .sort(
          (a, b) =>
            stats[b.id].wrong - stats[a.id].wrong ||
            (stats[b.id].lastWrongAt ?? '').localeCompare(stats[a.id].lastWrongAt ?? ''),
        ),
    [questions, stats],
  )
  const questionById = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions])

  if (error) return <p className="text-sm text-red-500">{error}</p>

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>오답노트 ({wrongQuestions.length})</CardTitle>
          <Button asChild size="sm" disabled={wrongQuestions.length === 0}>
            <a href="#/mini-test?scope=wrong">오답으로 미니 테스트</a>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중...</p>
          ) : wrongQuestions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              아직 틀린 문제가 없습니다. 학습이나 미니 테스트에서 틀린 문제가 자동으로 여기에 쌓입니다.
            </p>
          ) : (
            <ul>
              {wrongQuestions.map((question) => (
                <QuestionListRow key={question.id} question={question} stats={stats[question.id]} mark={marks[question.id]} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>미니 테스트 기록 ({history.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">아직 본 미니 테스트가 없습니다.</p>
          ) : (
            <ul>
              {history.map((record) => {
                const correct = record.items.filter((item) => item.isCorrect).length
                const wrongItems = record.items.filter((item) => !item.isCorrect)
                return (
                  <li key={record.id} className="border-b py-2 last:border-b-0">
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{formatTakenAt(record.takenAt)}</span>
                        <span>{record.scopeLabel}</span>
                        <Badge variant={wrongItems.length === 0 ? 'secondary' : 'outline'}>
                          {correct} / {record.items.length}
                        </Badge>
                      </summary>
                      <ul className="mt-2 flex flex-col gap-1 pl-4 text-sm">
                        {wrongItems.length === 0 && <li className="text-muted-foreground">전부 맞혔어요.</li>}
                        {wrongItems.map((item) => {
                          const question = questionById.get(item.questionId)
                          return (
                            <li key={item.questionId}>
                              <a href={`#/practice/${item.questionId}`} className="hover:underline">
                                {question ? `${question.year}년 ${question.number}번 · ${previewStem(question)}` : item.questionId}
                              </a>
                            </li>
                          )
                        })}
                      </ul>
                    </details>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
