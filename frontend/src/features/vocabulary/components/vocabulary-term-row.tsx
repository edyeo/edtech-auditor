import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { removeVocabularyTerm, updateVocabularyTerm } from '@/lib/learner-actions'
import type { VocabularyTerm } from '@/types/learner.types'

const MAX_MEMO_LENGTH = 2000

type VocabularyTermRowProps = {
  entry: VocabularyTerm
  /** "2021년 22회 1번", when the source question is known. */
  sourceLabel: string | null
}

export function VocabularyTermRow({ entry, sourceLabel }: VocabularyTermRowProps) {
  // The draft is saved when the field loses focus, so typing never waits on the server.
  const [draft, setDraft] = useState(entry.memo)

  function saveMemo() {
    if (draft !== entry.memo) void updateVocabularyTerm(entry.term, { memo: draft })
  }

  return (
    <li className="flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-base font-semibold">{entry.term}</span>
        {entry.studied && <Badge variant="secondary">공부 완료</Badge>}
        {entry.sourceQuestionId && sourceLabel && (
          <a href={`#/practice/${entry.sourceQuestionId}`} className="text-xs text-muted-foreground hover:underline">
            출처 {sourceLabel}
          </a>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            aria-pressed={entry.studied}
            className="h-10 md:h-8"
            onClick={() => void updateVocabularyTerm(entry.term, { studied: !entry.studied })}
          >
            {entry.studied ? '다시 공부하기' : '공부 완료'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 md:h-8"
            onClick={() => {
              if (window.confirm(`"${entry.term}" 단어를 단어장에서 지울까요?`)) void removeVocabularyTerm(entry.term)
            }}
          >
            삭제
          </Button>
        </div>
      </div>
      <Textarea
        aria-label={`${entry.term} 메모`}
        placeholder="개념 정리, 헷갈리는 점 등을 적어 두세요."
        maxLength={MAX_MEMO_LENGTH}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={saveMemo}
      />
    </li>
  )
}
