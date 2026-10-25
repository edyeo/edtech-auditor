import { Separator } from '@/components/ui/separator'

type ExplanationPanelProps = {
  isLoading: boolean
  error: string | null
  explanation: string | null
}

export function ExplanationPanel({ isLoading, error, explanation }: ExplanationPanelProps) {
  if (!isLoading && !error && !explanation) {
    return null
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm">
      <Separator className="mb-3" />
      {isLoading && <p className="text-muted-foreground">해설을 불러오는 중...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {explanation && <p className="whitespace-pre-wrap leading-relaxed">{explanation}</p>}
    </div>
  )
}
