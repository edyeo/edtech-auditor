import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { VocabularyTermRow } from '@/features/vocabulary/components/vocabulary-term-row'
import { useQuestionBank } from '@/lib/use-question-bank'
import { useVocabulary } from '@/lib/use-vocabulary'

type StudiedFilter = 'all' | 'todo' | 'done'

/** 단어장: the words saved from the questions, with the learner's own memo for each. */
export function VocabularyPage() {
  const { terms } = useVocabulary()
  const { questions } = useQuestionBank()
  const [filter, setFilter] = useState<StudiedFilter>('all')
  const [query, setQuery] = useState('')

  const sourceLabels = useMemo(
    () => new Map(questions.map((question) => [question.id, `${question.year}년 ${question.round}회 ${question.number}번`])),
    [questions],
  )
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return terms.filter(
      (entry) =>
        (filter === 'all' || entry.studied === (filter === 'done')) &&
        (!needle || entry.term.toLowerCase().includes(needle) || entry.memo.toLowerCase().includes(needle)),
    )
  }, [terms, filter, query])
  const doneCount = terms.filter((entry) => entry.studied).length

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>
          단어장 ({terms.length}) <span className="text-sm font-normal text-muted-foreground">공부 완료 {doneCount}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          문제, 보기, 해설에서 단어를 드래그하면 나타나는 &quot;단어장에 저장&quot; 버튼으로 저장합니다. 저장한 단어는
          모든 화면에서 노란색으로 표시됩니다.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="공부 상태"
            value={filter}
            onChange={(event) => setFilter(event.target.value as StudiedFilter)}
          >
            <option value="all">전체</option>
            <option value="todo">공부 전</option>
            <option value="done">공부 완료</option>
          </NativeSelect>
          <Input
            type="search"
            aria-label="검색"
            placeholder="단어·메모 검색"
            className="min-w-40 flex-1"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {terms.length === 0 ? '아직 저장한 단어가 없습니다.' : '조건에 맞는 단어가 없습니다.'}
          </p>
        ) : (
          <ul>
            {visible.map((entry) => (
              <VocabularyTermRow
                key={entry.term}
                entry={entry}
                sourceLabel={entry.sourceQuestionId ? (sourceLabels.get(entry.sourceQuestionId) ?? null) : null}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
