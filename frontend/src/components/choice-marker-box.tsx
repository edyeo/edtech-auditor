import { MarkerBox } from '@/components/marker-box'
import { useChoiceMarks } from '@/lib/use-choice-marks'

type ChoiceMarkerBoxProps = {
  questionId: string
  /** 0-based position of the choice. */
  choiceIndex: number
}

/** The markers of one answer choice (보기); the question's own markers sit with its title. */
export function ChoiceMarkerBox({ questionId, choiceIndex }: ChoiceMarkerBoxProps) {
  const { markCount, maxMarkCount, setMarkCount } = useChoiceMarks()
  const key = `${questionId}#${choiceIndex}`

  return (
    <MarkerBox
      count={markCount(key)}
      maxCount={maxMarkCount}
      label={`${choiceIndex + 1}번 보기 마커`}
      onChange={(count) => setMarkCount(key, count)}
    />
  )
}
