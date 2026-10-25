import { useState } from 'react'
import { ExamSession } from '@/features/exam'
import { useQuestionMarks } from '@/lib/use-question-marks'

/** Practice every marked question. The set is fixed on entry so un-marking mid-session doesn't reshuffle it. */
export function MarkedPracticePage() {
  const { markedIds } = useQuestionMarks()
  const [scopeIds] = useState(markedIds)

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <a href="#/marked" className="text-sm text-muted-foreground hover:underline">
        ← 마킹한 문항
      </a>
      <ExamSession scopeIds={scopeIds} />
    </div>
  )
}
