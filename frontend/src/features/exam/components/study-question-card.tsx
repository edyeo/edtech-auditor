import { QuestionMarkerBox } from '@/components/question-marker-box'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { QuestionAttemptActions } from '@/features/exam/components/question-attempt-actions'
import { QuestionAttemptBody } from '@/features/exam/components/question-attempt-body'
import { useQuestionAttempt } from '@/features/exam/utils/use-question-attempt'
import { getQuestionSection } from '@/lib/question-section'
import type { QuestionPublic } from '@/types/question.types'

type StudyQuestionCardProps = {
  question: QuestionPublic
}

/** One question of the study list, answered in place. */
export function StudyQuestionCard({ question }: StudyQuestionCardProps) {
  const attempt = useQuestionAttempt(question)

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-1">
          <CardTitle>
            {getQuestionSection(question)} · {question.year}년 {question.round}회 {question.number}번
          </CardTitle>
          <QuestionMarkerBox questionId={question.id} />
        </div>
      </CardHeader>
      <CardContent>
        <QuestionAttemptBody question={question} attempt={attempt} />
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <QuestionAttemptActions attempt={attempt} />
      </CardFooter>
    </Card>
  )
}
