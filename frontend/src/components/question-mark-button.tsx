import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQuestionMarks } from '@/lib/use-question-marks'

type QuestionMarkButtonProps = {
  questionId: string
}

export function QuestionMarkButton({ questionId }: QuestionMarkButtonProps) {
  const { isMarked, toggleMark } = useQuestionMarks()
  const marked = isMarked(questionId)

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-10 md:size-7"
      aria-pressed={marked}
      aria-label={marked ? '오답 마킹 해제' : '오답으로 마킹'}
      title={marked ? '오답 마킹 해제' : '오답으로 마킹'}
      onClick={() => toggleMark(questionId)}
    >
      <Star className={marked ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground'} />
    </Button>
  )
}
