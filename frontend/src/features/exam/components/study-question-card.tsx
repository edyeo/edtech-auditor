import { QuestionMarkerBox } from '@/components/question-marker-box'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { QuestionAttemptActions } from '@/features/exam/components/question-attempt-actions'
import { QuestionAttemptBody } from '@/features/exam/components/question-attempt-body'
import { useQuestionAttempt } from '@/features/exam/utils/use-question-attempt'
import { getQuestionSection } from '@/lib/question-section'
import { useQuestionStats } from '@/lib/use-question-stats'
import type { QuestionPublic } from '@/types/question.types'

type StudyQuestionCardProps = {
  question: QuestionPublic
}

/** One question of the study list, answered in place. */
export function StudyQuestionCard({ question }: StudyQuestionCardProps) {
  const attempt = useQuestionAttempt(question)
  const stats = useQuestionStats()[question.id]

  return (
    <Card data-question-id={question.id} className="w-full">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-1">
          <CardTitle>
            {getQuestionSection(question)} · {question.year}년 {question.round}회 {question.number}번
          </CardTitle>
          <QuestionMarkerBox questionId={question.id} />
        </div>
        <p className="text-xs text-muted-foreground">
          {stats && stats.attempts > 0 ? `풀이 ${stats.attempts}회 · 오답 ${stats.wrong}회` : '아직 안 풀어봄'}
        </p>
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
