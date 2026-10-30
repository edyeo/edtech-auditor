import { Badge } from '@/components/ui/badge'
import { QuestionMarkButton } from '@/components/question-mark-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { QuestionChoiceList } from '@/components/question-choice-list'
import { ConfidencePicker } from '@/features/exam/components/confidence-picker'
import { ExplanationPanel } from '@/features/exam/components/explanation-panel'
import { QuestionStem } from '@/components/question-stem'
import { ReviewModeToggle } from '@/features/exam/components/review-mode-toggle'
import { SelfExplainInput } from '@/features/exam/components/self-explain-input'
import { useExamSession } from '@/features/exam/utils/use-exam-session'

type ExamSessionProps = {
  /** Restrict the session to these questions (single-question practice, marked set). */
  scopeIds?: string[]
}

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
    selectedIndex,
    confidence,
    setConfidence,
    selfExplanation,
    setSelfExplanation,
    canSubmit,
    correctIndex,
    correctIndexes,
    isCorrect,
    overconfidentMiss,
    nextReviewDays,
    explanation,
    isExplaining,
    explanationError,
    submitError,
    loadError,
    selectChoice,
    submitAnswer,
    requestExplanation,
    goToNextQuestion,
    hasNextQuestion,
  } = useExamSession(scopeIds)

  if (loadError) {
    return <p className="text-sm text-red-500">{loadError}</p>
  }

  const isChecked = correctIndex !== null

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
            <div className="flex items-center justify-between">
              <CardTitle>
                {currentQuestion.subject} · {currentQuestion.year}년 {currentQuestion.round}회{' '}
                {currentQuestion.number}번
              </CardTitle>
              <div className="flex items-center gap-1">
                <Badge variant="secondary">
                  {queueIndex + 1} / {queue.length}
                </Badge>
                <QuestionMarkButton questionId={currentQuestion.id} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <QuestionStem stem={currentQuestion.stem} imageUrl={currentQuestion.image_url} />
            <QuestionChoiceList
              choices={currentQuestion.choices}
              selectedIndex={selectedIndex}
              correctIndex={correctIndex}
              correctIndexes={correctIndexes}
              onSelect={selectChoice}
            />

            {selectedIndex !== null && !isChecked && (
              <>
                <ConfidencePicker value={confidence} disabled={isChecked} onChange={setConfidence} />
                <SelfExplainInput
                  value={selfExplanation}
                  disabled={isChecked}
                  onChange={setSelfExplanation}
                />
              </>
            )}

            {isChecked && (
              <div className="flex flex-col gap-1">
                <p className={isCorrect ? 'text-sm text-emerald-600' : 'text-sm text-red-500'}>
                  {isCorrect ? '정답입니다!' : '오답입니다.'}
                </p>
                {overconfidentMiss && (
                  <p className="text-sm text-amber-600">
                    확신했는데 틀렸어요 — 이런 문항이 가장 기억에 안 남는 함정입니다. 복습 큐
                    맨 앞으로 보냈어요.
                  </p>
                )}
                {!overconfidentMiss && nextReviewDays !== null && (
                  <p className="text-xs text-muted-foreground">
                    {nextReviewDays === 0
                      ? '다음 복습: 오늘 다시'
                      : `다음 복습: ${nextReviewDays}일 후`}
                  </p>
                )}
              </div>
            )}

            {submitError && <p className="text-sm text-red-500">{submitError}</p>}

            <ExplanationPanel
              isLoading={isExplaining}
              error={explanationError}
              explanation={explanation}
            />
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            {!isChecked && (
              <Button className="h-11 flex-1 md:h-8 md:flex-none" onClick={submitAnswer} disabled={!canSubmit}>
                채점하기
              </Button>
            )}
            {isChecked && (
              <>
                <Button
                  variant="outline"
                  className="h-11 flex-1 md:h-8 md:flex-none"
                  onClick={requestExplanation}
                  disabled={isExplaining}
                >
                  설명
                </Button>
                <Button className="h-11 flex-1 md:h-8 md:flex-none" onClick={goToNextQuestion} disabled={!hasNextQuestion}>
                  다음 문제
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
