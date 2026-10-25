import { useMemo, useState } from 'react'
import { MiniTestResult } from '@/features/mini-test/components/mini-test-result'
import { MiniTestRun } from '@/features/mini-test/components/mini-test-run'
import { MiniTestSetup } from '@/features/mini-test/components/mini-test-setup'
import {
  describeConfig,
  pickQuestions,
  type MiniTestConfig,
  type MiniTestScope,
} from '@/features/mini-test/utils/build-mini-test'
import { submitMiniTest } from '@/lib/learner-actions'
import { useQuestionBank } from '@/lib/use-question-bank'
import { useQuestionMarks } from '@/lib/use-question-marks'
import { useQuestionStats } from '@/lib/use-question-stats'
import type { MiniTestRecord } from '@/types/learner.types'
import type { QuestionPublic } from '@/types/question.types'

type Phase =
  | { kind: 'setup' }
  | { kind: 'run'; questions: QuestionPublic[]; label: string }
  | { kind: 'result'; questions: QuestionPublic[]; record: MiniTestRecord; autoMarkedIds: string[] }

type MiniTestPageProps = {
  initialScope?: MiniTestScope
}

export function MiniTestPage({ initialScope = 'all' }: MiniTestPageProps) {
  const { questions, isLoading, error: loadError } = useQuestionBank()
  const { markedIds } = useQuestionMarks()
  const stats = useQuestionStats()
  const markedSet = useMemo(() => new Set(markedIds), [markedIds])

  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (loadError) return <p className="text-sm text-red-500">{loadError}</p>
  if (isLoading) return <p className="text-sm text-muted-foreground">문제를 불러오는 중...</p>

  function start(config: MiniTestConfig, pool: QuestionPublic[]) {
    const picked = pickQuestions(pool, config.count)
    setSubmitError(null)
    setPhase({ kind: 'run', questions: picked, label: describeConfig(config, picked.length) })
  }

  async function submit(run: Extract<Phase, { kind: 'run' }>, answers: Record<string, number>) {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      // The server grades every answer, updates stats/auto-marks and stores the test in one transaction.
      const { record, autoMarkedIds } = await submitMiniTest(
        run.label,
        run.questions.map((question) => ({ questionId: question.id, selectedIndex: answers[question.id] })),
      )
      setPhase({ kind: 'result', questions: run.questions, record, autoMarkedIds })
    } catch {
      setSubmitError('채점하지 못했습니다. 잠시 후 다시 제출해 주세요. (답변은 그대로 유지됩니다)')
    } finally {
      setIsSubmitting(false)
    }
  }

  switch (phase.kind) {
    case 'run':
      return (
        <MiniTestRun
          questions={phase.questions}
          isSubmitting={isSubmitting}
          error={submitError}
          onSubmit={(answers) => void submit(phase, answers)}
        />
      )
    case 'result':
      return (
        <MiniTestResult
          questions={phase.questions}
          record={phase.record}
          autoMarkedIds={phase.autoMarkedIds}
          onRetry={() => setPhase({ kind: 'setup' })}
        />
      )
    default:
      return (
        <MiniTestSetup
          questions={questions}
          markedIds={markedSet}
          stats={stats}
          initialScope={initialScope}
          onStart={start}
        />
      )
  }
}
