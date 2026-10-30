import { Button } from '@/components/ui/button'
import { cn } from 'cn'
import type { ConfidenceLevel } from '@/types/learner.types'

const OPTIONS: { value: ConfidenceLevel; label: string }[] = [
  { value: 'low', label: '낮음' },
  { value: 'medium', label: '보통' },
  { value: 'high', label: '높음' },
]

type ConfidencePickerProps = {
  value: ConfidenceLevel | null
  disabled: boolean
  onChange: (value: ConfidenceLevel) => void
}

export function ConfidencePicker({ value, disabled, onChange }: ConfidencePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">이 답이 맞다고 얼마나 확신하세요?</p>
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? 'default' : 'outline'}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn('h-11 flex-1 md:h-7 md:flex-none', value === option.value && 'pointer-events-none')}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
