import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQuestionMarks } from '@/lib/use-question-marks'
import { cn } from '@/lib/utils'

type QuestionMarkerBoxProps = {
  questionId: string
}

/** Squares that fill up as a question is missed more often; − and + adjust them by hand. */
export function QuestionMarkerBox({ questionId }: QuestionMarkerBoxProps) {
  const { markCount, maxMarkCount, setMarkCount } = useQuestionMarks()
  const count = markCount(questionId)

  return (
    <div role="group" aria-label="오답 마커" className="flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-10 md:size-7"
        disabled={count <= 0}
        aria-label="마커 하나 빼기"
        title="마커 하나 빼기"
        onClick={() => setMarkCount(questionId, count - 1)}
      >
        <Minus />
      </Button>
      <span role="img" aria-label={`마커 ${count}개`} title={`마커 ${count}개`} className="flex items-center gap-1">
        {Array.from({ length: maxMarkCount }, (_, index) => (
          <span
            key={index}
            className={cn(
              'size-3 rounded-[3px] border',
              index < count ? 'border-amber-500 bg-amber-400' : 'border-muted-foreground/50',
            )}
          />
        ))}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-10 md:size-7"
        disabled={count >= maxMarkCount}
        aria-label="마커 하나 더하기"
        title="마커 하나 더하기"
        onClick={() => setMarkCount(questionId, count + 1)}
      >
        <Plus />
      </Button>
    </div>
  )
}
