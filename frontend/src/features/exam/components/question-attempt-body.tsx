import { QuestionChoiceList } from '@/components/question-choice-list'
import { QuestionStem } from '@/components/question-stem'
import { ExplanationPanel } from '@/features/exam/components/explanation-panel'
import type { QuestionAttempt } from '@/features/exam/utils/use-question-attempt'
import type { QuestionPublic } from '@/types/question.types'

type QuestionAttemptBodyProps = {
  question: QuestionPublic
  attempt: QuestionAttempt
}

/** The whole question with its choices, plus everything that appears while answering it. */
export function QuestionAttemptBody({ question, attempt }: QuestionAttemptBodyProps) {
  const {
    selectedIndex,
    isChecked,
    correctIndex,
    correctIndexes,
    isCorrect,
    nextReviewDays,
    explanation,
    isExplaining,
    explanationError,
    submitError,
    selectChoice,
  } = attempt

  return (
    <div className="flex flex-col gap-4">
      <QuestionStem stem={question.stem} imageUrl={question.image_url} />
      <QuestionChoiceList
        choices={question.choices}
        selectedIndex={selectedIndex}
        correctIndex={correctIndex}
        correctIndexes={correctIndexes}
        onSelect={selectChoice}
      />

      {isChecked && (
        <div className="flex flex-col gap-1">
          <p className={isCorrect ? 'text-sm text-emerald-600' : 'text-sm text-red-500'}>
            {isCorrect ? '정답입니다!' : '오답입니다. 마커가 하나 늘었어요.'}
          </p>
          {nextReviewDays !== null && (
            <p className="text-xs text-muted-foreground">
              {nextReviewDays === 0 ? '다음 복습: 오늘 다시' : `다음 복습: ${nextReviewDays}일 후`}
            </p>
          )}
        </div>
      )}

      {submitError && <p className="text-sm text-red-500">{submitError}</p>}

      <ExplanationPanel isLoading={isExplaining} error={explanationError} explanation={explanation} />
    </div>
  )
}
