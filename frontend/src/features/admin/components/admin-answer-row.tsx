import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AdminQuestion } from '@/types/question.types'

type AdminAnswerRowProps = {
  question: AdminQuestion
  onSave: (answerIndexes: number[]) => Promise<void>
  onRevert: () => Promise<void>
}

function currentAnswers(question: AdminQuestion): number[] {
  return [question.answer_index, ...question.also_correct].sort((a, b) => a - b)
}

export function AdminAnswerRow({ question, onSave, onRevert }: AdminAnswerRowProps) {
  // The parent remounts this row (via key) whenever the saved answer changes, so the draft
  // always starts from the stored answer.
  const [draft, setDraft] = useState<number[]>(() => currentAnswers(question))
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const saved = currentAnswers(question)
  const isDirty = draft.length !== saved.length || draft.some((value, i) => value !== saved[i])

  function toggle(index: number) {
    setMessage(null)
    setDraft((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index].sort((a, b) => a - b),
    )
  }

  async function run(action: () => Promise<void>) {
    setIsBusy(true)
    try {
      await action()
    } catch (caught) {
      setMessage({ text: caught instanceof Error ? caught.message : '저장하지 못했습니다.', isError: true })
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="w-16 shrink-0 text-sm font-medium">
          {question.year} · {question.number}번
        </span>
        <fieldset className="flex items-center gap-3" aria-label={`${question.year}년 ${question.number}번 정답`}>
          {question.choices.map((_, index) => (
            <label key={index} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={draft.includes(index)} onChange={() => toggle(index)} />
              {index + 1}
            </label>
          ))}
        </fieldset>
        <Button size="sm" disabled={!isDirty || draft.length === 0 || isBusy} onClick={() => run(() => onSave(draft))}>
          저장
        </Button>
        {question.answer_overridden && (
          <>
            <Badge variant="secondary">수정됨</Badge>
            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => run(onRevert)}>
              원복
            </Button>
          </>
        )}
        {draft.length > 1 && <Badge variant="outline">복수정답</Badge>}
        {message && <span className={message.isError ? 'text-xs text-red-500' : 'text-xs text-emerald-600'}>{message.text}</span>}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          {question.subject} · {question.stem.split('\n')[0].slice(0, 60) || '(본문 없음)'}
        </summary>
        <div className="mt-2 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          {question.image_url ? (
            <img src={question.image_url} alt={question.stem} className="max-w-full rounded-md border bg-white" />
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{question.stem}</p>
          )}
          <ol className="flex flex-col gap-1">
            {question.choices.map((choice, index) => (
              <li key={index} className={saved.includes(index) ? 'font-medium text-emerald-700' : undefined}>
                {index + 1}. {choice || '(그림 참고)'}
              </li>
            ))}
          </ol>
          {question.source && <p className="text-xs text-muted-foreground">출처: {question.source}</p>}
        </div>
      </details>
    </li>
  )
}
