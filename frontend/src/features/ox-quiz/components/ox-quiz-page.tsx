import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { OxStatementRow } from '@/features/ox-quiz/components/ox-statement-row'
import { useOxQuiz } from '@/features/ox-quiz/utils/use-ox-quiz'

export function OxQuizPage() {
  const quiz = useOxQuiz()

  if (quiz.error) {
    return <p className="text-sm text-red-500">{quiz.error}</p>
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>O/X 퀴즈 ({quiz.totalCount})</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            정답 {quiz.correctCount} / {quiz.answeredCount}
          </Badge>
          <Button type="button" variant="outline" className="h-10 md:h-8" onClick={quiz.reshuffle}>
            다시 섞기
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          감리 과목 문항(사업관리 제외)의 보기와 항목을 문장으로 만들었습니다. 옳은 설명이면 O, 옳지 않은 설명이면
          X를 고르세요. 어느 문제에서 나온 문장인지는 &quot;문제보기&quot;에서 기출 연도와 전체 문제로 확인할 수
          있습니다.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="연도"
            value={quiz.filter.year}
            onChange={(e) => quiz.updateFilter({ year: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
          >
            <option value="all">전체 연도</option>
            {quiz.years.map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </NativeSelect>
          {quiz.subjects.length > 1 && (
            <NativeSelect
              aria-label="과목"
              value={quiz.filter.subject}
              onChange={(e) => quiz.updateFilter({ subject: e.target.value })}
            >
              <option value="all">전체 과목</option>
              {quiz.subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </NativeSelect>
          )}
          <Input
            type="search"
            aria-label="검색"
            placeholder="문장 검색"
            className="min-w-40 flex-1"
            value={quiz.filter.query}
            onChange={(e) => quiz.updateFilter({ query: e.target.value })}
          />
        </div>

        {quiz.answerError && (
          <p role="alert" className="text-sm text-red-500">
            {quiz.answerError}
          </p>
        )}

        {quiz.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">문제를 불러오는 중...</p>
        ) : quiz.visibleItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">조건에 맞는 보기가 없습니다.</p>
        ) : (
          <ul>
            {quiz.visibleItems.map((item) => (
              <OxStatementRow
                key={item.key}
                item={item}
                result={quiz.results[item.key]}
                isPending={quiz.pendingKeys.has(item.key)}
                onAnswer={quiz.answer}
              />
            ))}
          </ul>
        )}

        {quiz.hasMore && (
          <Button type="button" variant="outline" className="h-11 md:h-8" onClick={quiz.showMore}>
            더 보기
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
