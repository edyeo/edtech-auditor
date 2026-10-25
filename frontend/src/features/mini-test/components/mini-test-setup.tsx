import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import {
  MINI_TEST_COUNTS,
  SCOPE_LABELS,
  selectPool,
  type MiniTestConfig,
  type MiniTestScope,
} from '@/features/mini-test/utils/build-mini-test'
import type { QuestionStatsMap } from '@/types/learner.types'
import type { QuestionPublic } from '@/types/question.types'

type MiniTestSetupProps = {
  questions: QuestionPublic[]
  markedIds: ReadonlySet<string>
  stats: QuestionStatsMap
  initialScope: MiniTestScope
  onStart: (config: MiniTestConfig, pool: QuestionPublic[]) => void
}

export function MiniTestSetup({ questions, markedIds, stats, initialScope, onStart }: MiniTestSetupProps) {
  const [config, setConfig] = useState<MiniTestConfig>({ scope: initialScope, year: 'all', subject: 'all', count: 10 })

  const years = useMemo(() => [...new Set(questions.map((q) => q.year))].sort((a, b) => b - a), [questions])
  const subjects = useMemo(() => [...new Set(questions.map((q) => q.subject))], [questions])
  const pool = useMemo(() => selectPool(questions, config, markedIds, stats), [questions, config, markedIds, stats])
  const scopeCounts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(SCOPE_LABELS) as MiniTestScope[]).map((scope) => [
          scope,
          selectPool(questions, { ...config, scope }, markedIds, stats).length,
        ]),
      ) as Record<MiniTestScope, number>,
    [questions, config, markedIds, stats],
  )

  function update(patch: Partial<MiniTestConfig>) {
    setConfig((current) => ({ ...current, ...patch }))
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>미니 테스트</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          문제를 풀고 한꺼번에 제출하면 채점되고, 결과는 자동으로 기록되어 틀린 문제가 오답노트에 쌓입니다.
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">출제 범위</legend>
          {(Object.keys(SCOPE_LABELS) as MiniTestScope[]).map((scope) => (
            <label key={scope} className="flex items-center gap-2 text-sm">
              <input type="radio" name="mini-test-scope" checked={config.scope === scope} onChange={() => update({ scope })} />
              {SCOPE_LABELS[scope]} ({scopeCounts[scope]})
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="연도"
            value={config.year}
            onChange={(e) => update({ year: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
          >
            <option value="all">전체 연도</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="과목" value={config.subject} onChange={(e) => update({ subject: e.target.value })}>
            <option value="all">전체 과목</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="문항 수" value={config.count} onChange={(e) => update({ count: Number(e.target.value) })}>
            {MINI_TEST_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count}문항
              </option>
            ))}
          </NativeSelect>
        </div>

        {pool.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            조건에 맞는 문제가 없습니다. {config.scope !== 'all' && '범위를 "전체"로 바꾸거나 먼저 문제를 풀어 보세요.'}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            조건에 맞는 문제 {pool.length}개 중 {Math.min(config.count, pool.length)}문항을 무작위로 출제합니다.
          </p>
        )}

        <Button disabled={pool.length === 0} onClick={() => onStart(config, pool)}>
          테스트 시작
        </Button>
      </CardContent>
    </Card>
  )
}
