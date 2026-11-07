import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type MarkerBoxProps = {
  count: number
  maxCount: number
  /** What the markers are on, for screen readers ("오답 마커", "보기 마커"). */
  label: string
  onChange: (count: number) => void
}

/** Squares that fill up as something is missed more often; − and + adjust them by hand. */
export function MarkerBox({ count, maxCount, label, onChange }: MarkerBoxProps) {
  return (
    <div role="group" aria-label={label} className="flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-10 md:size-7"
        disabled={count <= 0}
        aria-label="마커 하나 빼기"
        title="마커 하나 빼기"
        onClick={() => onChange(count - 1)}
      >
        <Minus />
      </Button>
      <span role="img" aria-label={`마커 ${count}개`} title={`마커 ${count}개`} className="flex items-center gap-1">
        {Array.from({ length: maxCount }, (_, index) => (
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
        disabled={count >= maxCount}
        aria-label="마커 하나 더하기"
        title="마커 하나 더하기"
        onClick={() => onChange(count + 1)}
      >
        <Plus />
      </Button>
    </div>
  )
}
