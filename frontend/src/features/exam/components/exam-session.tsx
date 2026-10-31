import { QuestionMarkerBox } from '@/components/question-marker-box'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { QuestionAttemptActions } from '@/features/exam/components/question-attempt-actions'
import { QuestionAttemptBody } from '@/features/exam/components/question-attempt-body'
import { ReviewModeToggle } from '@/features/exam/components/review-mode-toggle'
import { useExamSession } from '@/features/exam/utils/use-exam-session'
import { getQuestionSection } from '@/lib/question-section'

type ExamSessionProps = {
  /** Restrict the session to these questions (single-question practice, marked set). */
  scopeIds?: string[]
}

/** One question at a time, in review-queue order. The 학습 tab itself is `StudyListPage`. */
export function ExamSession({ scopeIds }: ExamSessionProps = {}) {
  const {
    mode,
    setMode,
    dueCount,
    totalCount,
    isLoading,
    queue,
    queueIndex,
    currentQuestion,
    attempt,
    loadError,
    goToNextQuestion,
    hasNextQuestion,
  } = useExamSession(scopeIds)

  if (loadError) {
    return <p className="text-sm text-red-500">{loadError}</p>
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      {!scopeIds && (
        <ReviewModeToggle mode={mode} dueCount={dueCount} totalCount={totalCount} onChange={setMode} />
      )}

      {!currentQuestion ? (
        <Card className="w-full">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {isLoading || (!scopeIds && mode !== 'due')
              ? '문제를 불러오는 중...'
              : scopeIds
                ? '표시할 문제가 없습니다.'
                : '오늘 복습할 문제를 모두 끝냈습니다. 👏 "전체"를 눌러 더 연습해보세요.'}
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-1">
              <CardTitle>
                {getQuestionSection(currentQuestion)} · {currentQuestion.year}년 {currentQuestion.round}회{' '}
                {currentQuestion.number}번
              </CardTitle>
              <div className="flex items-center gap-1">
                <Badge variant="secondary">
                  {queueIndex + 1} / {queue.length}
                </Badge>
                <QuestionMarkerBox questionId={currentQuestion.id} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <QuestionAttemptBody question={currentQuestion} attempt={attempt} />
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <QuestionAttemptActions
              attempt={attempt}
              afterChecked={
                <Button className="h-11 flex-1 md:h-8 md:flex-none" onClick={goToNextQuestion} disabled={!hasNextQuestion}>
                  다음 문제
                </Button>
              }
            />
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
