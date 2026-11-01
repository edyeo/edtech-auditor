import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { QuestionAttempt } from '@/features/exam/utils/use-question-attempt'

type QuestionAttemptActionsProps = {
  attempt: QuestionAttempt
  /** Extra buttons shown after grading, next to 해설보기 (e.g. 다음 문제). */
  afterChecked?: ReactNode
}

/** 채점하기 (until graded) and 해설보기 (always); any extra button comes last. */
export function QuestionAttemptActions({ attempt, afterChecked }: QuestionAttemptActionsProps) {
  return (
    <>
      {!attempt.isChecked && (
        <Button className="h-11 flex-1 md:h-8 md:flex-none" onClick={attempt.submitAnswer} disabled={!attempt.canSubmit}>
          채점하기
        </Button>
      )}
      <Button
        variant="outline"
        className="h-11 flex-1 md:h-8 md:flex-none"
        aria-expanded={attempt.isExplanationOpen}
        onClick={attempt.toggleExplanation}
      >
        {attempt.isExplanationOpen ? '해설 닫기' : '해설보기'}
      </Button>
      {attempt.isChecked && afterChecked}
    </>
  )
}
