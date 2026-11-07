import { MarkerBox } from '@/components/marker-box'
import { useQuestionMarks } from '@/lib/use-question-marks'

type QuestionMarkerBoxProps = {
  questionId: string
}

/** The markers of a whole question: filled by wrong answers or by hand. */
export function QuestionMarkerBox({ questionId }: QuestionMarkerBoxProps) {
  const { markCount, maxMarkCount, setMarkCount } = useQuestionMarks()

  return (
    <MarkerBox
      count={markCount(questionId)}
      maxCount={maxMarkCount}
      label="오답 마커"
      onChange={(count) => setMarkCount(questionId, count)}
    />
  )
}
