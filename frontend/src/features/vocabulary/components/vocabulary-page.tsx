import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { VocabularyTermRow } from '@/features/vocabulary/components/vocabulary-term-row'
import { saveVocabularyTerm } from '@/lib/learner-actions'
import { getQuestionSection, listQuestionSections, QUESTION_SECTIONS } from '@/lib/question-section'
import { useQuestionBank } from '@/lib/use-question-bank'
import { useVocabulary } from '@/lib/use-vocabulary'
import { isSavableTerm, normalizeTerm } from '@/lib/vocabulary-term'
import type { VocabularyTerm } from '@/types/learner.types'

type StudiedFilter = 'all' | 'todo' | 'done'

/** Filter value for words that were not saved from a question. */
const NO_SOURCE = '__none__'

/** 단어장: the words saved from the questions, with the learner's own memo for each. */
export function VocabularyPage() {
  const { terms } = useVocabulary()
  const { questions } = useQuestionBank()
  const [filter, setFilter] = useState<StudiedFilter>('all')
  const [query, setQuery] = useState('')
  const [section, setSection] = useState('all')
  const [newTerm, setNewTerm] = useState('')
  const [newSection, setNewSection] = useState('')

  const sourceLabels = useMemo(
    () => new Map(questions.map((question) => [question.id, `${question.year}년 ${question.round}회 ${question.number}번`])),
    [questions],
  )
  // A note belongs to the section set by hand, else to the section of the question it was saved from.
  const sectionOf = useMemo(() => {
    const byId = new Map(questions.map((question) => [question.id, getQuestionSection(question)]))
    return (entry: VocabularyTerm) =>
      entry.section ?? (entry.sourceQuestionId ? (byId.get(entry.sourceQuestionId) ?? null) : null)
  }, [questions])
  const sections = useMemo(() => {
    const used = new Set(terms.flatMap((entry) => sectionOf(entry) ?? []))
    // Keep the sections in their usual order (subject order), listing only those that have words.
    return listQuestionSections(questions).filter((name) => used.has(name))
  }, [terms, questions, sectionOf])
  const hasWordsWithoutSource = terms.some((entry) => sectionOf(entry) === null)
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return terms.filter((entry) => {
      const entrySection = sectionOf(entry)
      if (section === NO_SOURCE ? entrySection !== null : section !== 'all' && entrySection !== section) return false
      if (filter !== 'all' && entry.studied !== (filter === 'done')) return false
      return !needle || entry.term.toLowerCase().includes(needle) || entry.memo.toLowerCase().includes(needle)
    })
  }, [terms, filter, query, section, sectionOf])
  const doneCount = terms.filter((entry) => entry.studied).length
  const newTermText = normalizeTerm(newTerm)

  async function createNote() {
    if (await saveVocabularyTerm(newTermText, null, newSection || null)) setNewTerm('')
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>
          단어장 ({terms.length}) <span className="text-sm font-normal text-muted-foreground">공부 완료 {doneCount}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          문제, 보기, 해설에서 단어를 드래그하면 나타나는 &quot;단어장에 저장&quot; 버튼으로 저장하거나, 아래에서 새 노트를
          직접 만듭니다. 노트는 마크다운으로 쓰고 이미지를 붙일 수 있으며, 노트 제목은 모든 화면에서 노란색으로 표시됩니다.
        </p>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (isSavableTerm(newTermText)) void createNote()
          }}
        >
          <Input
            aria-label="새 노트 제목"
            placeholder="새 노트 제목 (예: 요구정의단계 감리)"
            className="min-w-48 flex-1"
            maxLength={100}
            value={newTerm}
            onChange={(event) => setNewTerm(event.target.value)}
          />
          <NativeSelect aria-label="새 노트 과목" value={newSection} onChange={(event) => setNewSection(event.target.value)}>
            <option value="">과목 없음</option>
            {QUESTION_SECTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" className="h-10 md:h-8" disabled={!isSavableTerm(newTermText)}>
            노트 추가
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="과목" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="all">전체 과목</option>
            {sections.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            {hasWordsWithoutSource && <option value={NO_SOURCE}>과목 없음</option>}
          </NativeSelect>
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
                section={sectionOf(entry)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
