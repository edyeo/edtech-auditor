import { useMemo, useState } from 'react'
import { QuestionListPager } from '@/components/question-list-pager'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { ReviewModeToggle } from '@/features/exam/components/review-mode-toggle'
import { StudyQuestionCard } from '@/features/exam/components/study-question-card'
import {
  DEFAULT_STUDY_FILTER,
  filterStudyQuestions,
  orderStudyQueue,
  type StudyFilter,
} from '@/features/exam/utils/build-study-queue'
import { isDueForReview } from '@/features/exam/utils/is-due-for-review'
import type { SessionMode } from '@/features/exam/utils/use-exam-session'
import { paginateItems } from '@/lib/paginate-items'
import { listQuestionSections } from '@/lib/question-section'
import { useQuestionBank } from '@/lib/use-question-bank'
import { useReviewState } from '@/lib/use-review-state'
import type { ReviewStateMap } from '@/types/learner.types'

// Every card carries the whole question and its answering controls, so a page stays short.
const PAGE_SIZE = 10

/** The 학습 tab: questions in review order, each shown in full and answered in place. */
export function StudyListPage() {
  const { questions, isLoading, error } = useQuestionBank()
  const reviewState = useReviewState()
  const [mode, setMode] = useState<SessionMode>('due')
  const [filter, setFilter] = useState<StudyFilter>(DEFAULT_STUDY_FILTER)
  // The order is frozen to this snapshot: grading a question changes the live review state, and the
  // list must not reshuffle (or drop the card) under the learner. It is retaken when the list is
  // rebuilt on purpose, i.e. when the mode or a filter changes.
  const [queueReviewState, setQueueReviewState] = useState<ReviewStateMap>(reviewState)
  const [requestedPage, setRequestedPage] = useState(1)

  const years = useMemo(() => [...new Set(questions.map((q) => q.year))].sort((a, b) => b - a), [questions])
  const sections = useMemo(() => listQuestionSections(questions), [questions])
  const inScope = useMemo(() => filterStudyQuestions(questions, filter), [questions, filter])
  const queue = useMemo(
    () => orderStudyQueue(inScope, queueReviewState, mode),
    [inScope, queueReviewState, mode],
  )
  const dueCount = useMemo(
    () => inScope.filter((question) => isDueForReview(reviewState[question.id])).length,
    [inScope, reviewState],
  )
  const { items: pageItems, page, pageCount } = paginateItems(queue, requestedPage, PAGE_SIZE)

  function rebuild(patch: { mode?: SessionMode; filter?: Partial<StudyFilter> }) {
    setQueueReviewState(reviewState)
    if (patch.mode) setMode(patch.mode)
    if (patch.filter) setFilter((current) => ({ ...current, ...patch.filter }))
    setRequestedPage(1)
  }

  function goToPage(next: number) {
    setRequestedPage(next)
    window.scrollTo({ top: 0 })
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>학습 ({queue.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ReviewModeToggle
            mode={mode}
            dueCount={dueCount}
            totalCount={inScope.length}
            onChange={(next) => rebuild({ mode: next })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label="연도"
              value={filter.year}
              onChange={(e) => rebuild({ filter: { year: e.target.value === 'all' ? 'all' : Number(e.target.value) } })}
            >
              <option value="all">전체 연도</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="과목"
              value={filter.section}
              onChange={(e) => rebuild({ filter: { section: e.target.value } })}
            >
              <option value="all">전체 과목</option>
              {sections.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </NativeSelect>
            <Input
              type="search"
              aria-label="검색"
              placeholder="본문·보기 검색"
              className="min-w-40 flex-1"
              value={filter.query}
              onChange={(e) => rebuild({ filter: { query: e.target.value } })}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">문제를 불러오는 중...</p>
      ) : queue.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {mode === 'due' && inScope.length > 0
            ? '오늘 복습할 문제를 모두 끝냈습니다. 👏 "전체"를 눌러 더 연습해보세요.'
            : '조건에 맞는 문제가 없습니다.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pageItems.map((question) => (
            <li key={question.id}>
              <StudyQuestionCard question={question} />
            </li>
          ))}
        </ul>
      )}

      <QuestionListPager page={page} pageCount={pageCount} onChange={goToPage} />
    </div>
  )
}
