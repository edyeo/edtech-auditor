import { Textarea } from '@/components/ui/textarea'
import { MIN_SELF_EXPLANATION_LENGTH } from '@/features/exam/utils/use-exam-session'

type SelfExplainInputProps = {
  value: string
  disabled: boolean
  onChange: (value: string) => void
}

export function SelfExplainInput({ value, disabled, onChange }: SelfExplainInputProps) {
  const remaining = Math.max(MIN_SELF_EXPLANATION_LENGTH - value.trim().length, 0)

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="self-explanation" className="text-sm font-medium">
        왜 이 보기를 선택했는지 한 줄로 적어보세요
      </label>
      <Textarea
        id="self-explanation"
        rows={2}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="예: 감리법인은 독립성을 유지해야 하므로..."
      />
      <p className="text-xs text-muted-foreground">
        {remaining > 0
          ? `채점하려면 ${remaining}자 더 적어주세요 — 해설을 보기 전에 스스로 떠올려보는 게 기억에 남습니다.`
          : '좋아요, 채점할 준비가 됐습니다.'}
      </p>
    </div>
  )
}
