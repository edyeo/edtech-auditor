import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { QuestionAttempt } from '@/features/exam/utils/use-question-attempt'

type QuestionAttemptActionsProps = {
  attempt: QuestionAttempt
  /** Extra buttons shown after grading, next to 설명 (e.g. 다음 문제). */
  afterChecked?: ReactNode
}

/** 채점하기 before grading; 설명 (and any extra button) after. */
export function QuestionAttemptActions({ attempt, afterChecked }: QuestionAttemptActionsProps) {
  if (!attempt.isChecked) {
    return (
      <Button className="h-11 flex-1 md:h-8 md:flex-none" onClick={attempt.submitAnswer} disabled={!attempt.canSubmit}>
        채점하기
      </Button>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-11 flex-1 md:h-8 md:flex-none"
        onClick={attempt.requestExplanation}
        disabled={attempt.isExplaining}
      >
        설명
      </Button>
      {afterChecked}
    </>
  )
}
