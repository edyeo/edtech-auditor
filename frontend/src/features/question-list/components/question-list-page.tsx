import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { QuestionListRow } from '@/components/question-list-row'
import { NativeSelect } from '@/components/ui/native-select'
import {
  DEFAULT_QUESTION_FILTER,
  filterQuestions,
  type QuestionFilter,
} from '@/features/question-list/utils/filter-questions'
import { useQuestionBank } from '@/lib/use-question-bank'
import { useQuestionMarks } from '@/lib/use-question-marks'
import { useQuestionStats } from '@/lib/use-question-stats'

type QuestionListPageProps = {
  /** "마킹한 문항" mode: only marked questions, plus a button to practice them. */
  markedOnly?: boolean
}

export function QuestionListPage({ markedOnly = false }: QuestionListPageProps) {
  const { questions, isLoading, error } = useQuestionBank()
  const { marks, markedIds } = useQuestionMarks()
  const stats = useQuestionStats()
  const [filter, setFilter] = useState<QuestionFilter>(DEFAULT_QUESTION_FILTER)

  const years = useMemo(() => [...new Set(questions.map((q) => q.year))].sort((a, b) => b - a), [questions])
  const subjects = useMemo(() => [...new Set(questions.map((q) => q.subject))], [questions])
  const markedSet = useMemo(() => new Set(markedIds), [markedIds])

  const visible = useMemo(
    () => filterQuestions(questions, { ...filter, markedOnly: markedOnly || filter.markedOnly }, markedSet, stats),
    [questions, filter, markedOnly, markedSet, stats],
  )

  function update(patch: Partial<QuestionFilter>) {
    setFilter((current) => ({ ...current, ...patch }))
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          {markedOnly ? '마킹한 문항' : '문제 목록'} ({visible.length})
        </CardTitle>
        {markedOnly && (
          <Button asChild size="sm" disabled={markedIds.length === 0}>
            <a href="#/marked/practice">마킹 문항 풀기</a>
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="연도"
            value={filter.year}
            onChange={(e) => update({ year: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
          >
            <option value="all">전체 연도</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="과목" value={filter.subject} onChange={(e) => update({ subject: e.target.value })}>
            <option value="all">전체 과목</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </NativeSelect>
          <Input
            type="search"
            aria-label="검색"
            placeholder="본문·보기 검색"
            className="min-w-40 flex-1"
            value={filter.query}
            onChange={(e) => update({ query: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {!markedOnly && (
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={filter.markedOnly}
                onChange={(e) => update({ markedOnly: e.target.checked })}
              />
              마킹만
            </label>
          )}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={filter.wrongOnly} onChange={(e) => update({ wrongOnly: e.target.checked })} />
            틀린 적 있는 문제만
          </label>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">문제를 불러오는 중...</p>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {markedOnly && markedIds.length === 0
              ? '아직 마킹한 문항이 없습니다. 문제 카드나 목록의 별(★)을 눌러 표시해 보세요.'
              : '조건에 맞는 문제가 없습니다.'}
          </p>
        ) : (
          <ul>
            {visible.map((question) => (
              <QuestionListRow key={question.id} question={question} stats={stats[question.id]} mark={marks[question.id]} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
