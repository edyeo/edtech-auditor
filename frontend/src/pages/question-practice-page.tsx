import { useMemo } from 'react'
import { ExamSession } from '@/features/exam'

type QuestionPracticePageProps = {
  questionId: string
}

/** Practice a single question picked from the list. */
export function QuestionPracticePage({ questionId }: QuestionPracticePageProps) {
  const scopeIds = useMemo(() => [questionId], [questionId])

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <a href="#/questions" className="text-sm text-muted-foreground hover:underline">
        ← 문제 목록
      </a>
      <ExamSession key={questionId} scopeIds={scopeIds} />
    </div>
  )
}
