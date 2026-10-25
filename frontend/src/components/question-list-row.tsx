import { Badge } from '@/components/ui/badge'
import { QuestionMarkButton } from '@/components/question-mark-button'
import { previewStem } from '@/lib/question-preview'
import { useAutoMarkStreak } from '@/lib/use-question-stats'
import type { QuestionMark, QuestionStats } from '@/types/learner.types'
import type { QuestionPublic } from '@/types/question.types'

type QuestionListRowProps = {
  question: QuestionPublic
  stats: QuestionStats | undefined
  mark?: QuestionMark
}

export function QuestionListRow({ question, stats, mark }: QuestionListRowProps) {
  const streak = stats?.streak ?? 0
  const autoMarkStreak = useAutoMarkStreak()

  return (
    <li className="flex items-start gap-1 border-b py-2 last:border-b-0">
      <QuestionMarkButton questionId={question.id} />
      <a
        href={`#/practice/${question.id}`}
        className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-1 py-0.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="text-xs text-muted-foreground">
          {question.year}년 {question.round}회 {question.number}번 · {question.subject}
        </span>
        <span className="line-clamp-2 text-sm">{previewStem(question)}</span>
      </a>
      <div className="mt-1 flex shrink-0 flex-col items-end gap-1">
        {stats && stats.wrong > 0 && <Badge variant="secondary">오답 {stats.wrong}회</Badge>}
        {streak >= autoMarkStreak && <Badge variant="destructive">연속 {streak}회 오답</Badge>}
        {mark?.source === 'auto' && <Badge variant="outline">자동 마킹</Badge>}
      </div>
    </li>
  )
}
