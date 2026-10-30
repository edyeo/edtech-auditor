import { Button } from '@/components/ui/button'
import type { SessionMode } from '@/features/exam/utils/use-exam-session'

type ReviewModeToggleProps = {
  mode: SessionMode
  dueCount: number
  totalCount: number
  onChange: (mode: SessionMode) => void
}

export function ReviewModeToggle({ mode, dueCount, totalCount, onChange }: ReviewModeToggleProps) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant={mode === 'due' ? 'default' : 'outline'}
        className="h-10 md:h-7"
        onClick={() => onChange('due')}
      >
        오늘 복습 ({dueCount})
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === 'all' ? 'default' : 'outline'}
        className="h-10 md:h-7"
        onClick={() => onChange('all')}
      >
        전체 ({totalCount})
      </Button>
    </div>
  )
}
