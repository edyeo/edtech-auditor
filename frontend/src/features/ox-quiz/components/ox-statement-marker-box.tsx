import { MarkerBox } from '@/components/marker-box'
import { useOxStatementMarks } from '@/lib/use-ox-statement-marks'

type OxStatementMarkerBoxProps = {
  /** "question_id#statement_index" */
  statementKey: string
}

/** The markers of one statement; the question's own markers are in its "문제보기" panel. */
export function OxStatementMarkerBox({ statementKey }: OxStatementMarkerBoxProps) {
  const { markCount, maxMarkCount, setMarkCount } = useOxStatementMarks()

  return (
    <MarkerBox
      count={markCount(statementKey)}
      maxCount={maxMarkCount}
      label="보기 마커"
      onChange={(count) => setMarkCount(statementKey, count)}
    />
  )
}
