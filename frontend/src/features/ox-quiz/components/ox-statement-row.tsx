import { useCallback, useState } from 'react'
import { ExplanationPanel } from '@/components/explanation-panel'
import { QuestionMarkerBox } from '@/components/question-marker-box'
import { Button } from '@/components/ui/button'
import { OxQuestionDetail } from '@/features/ox-quiz/components/ox-question-detail'
import type { OxAnswer, OxItem, OxResult } from '@/features/ox-quiz/types/ox-quiz.types'
import { fetchOxExplanation } from '@/features/ox-quiz/utils/ox-quiz.api'
import { useToggledExplanation } from '@/features/ox-quiz/utils/use-toggled-explanation'
import { cn } from '@/lib/utils'

const ANSWERS: OxAnswer[] = ['O', 'X']

type OxStatementRowProps = {
  item: OxItem
  result: OxResult | undefined
  isPending: boolean
  onAnswer: (item: OxItem, answer: OxAnswer) => void
}

export function OxStatementRow({ item, result, isPending, onAnswer }: OxStatementRowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const detailId = `ox-detail-${item.key.replace('#', '-')}`
  const loadExplanation = useCallback(
    () => fetchOxExplanation(item.question.id, item.statementIndex),
    [item.question.id, item.statementIndex],
  )
  const explanation = useToggledExplanation(loadExplanation)

  return (
    <li className="border-b py-3 last:border-b-0">
      {/* Markers belong to the question, so every statement of it shows the same boxes. On narrow screens
          they sit on their own line above the statement, at the right. */}
      <div className="flex flex-col-reverse items-end gap-1 md:flex-row md:items-start md:justify-between md:gap-3">
        <p className="w-full text-base leading-relaxed md:w-auto md:text-sm">{item.statement}</p>
        <div className="shrink-0">
          <QuestionMarkerBox questionId={item.question.id} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="옳은 설명이면 O, 옳지 않은 설명이면 X" className="flex gap-2">
          {ANSWERS.map((answer) => {
            const isChosen = result?.answer === answer
            return (
              <Button
                key={answer}
                type="button"
                variant="outline"
                aria-pressed={isChosen}
                disabled={result !== undefined || isPending}
                onClick={() => onAnswer(item, answer)}
                className={cn(
                  'h-11 w-14 text-base font-semibold md:h-8 md:w-12',
                  isChosen && 'disabled:opacity-100',
                  isChosen && result?.isCorrect === true && 'border-emerald-500 bg-emerald-500/10 text-emerald-700',
                  isChosen && result?.isCorrect === false && 'border-red-500 bg-red-500/10 text-red-700',
                )}
              >
                {answer}
              </Button>
            )
          })}
        </div>
        {result && (
          <p role="status" className={cn('text-sm', result.isCorrect ? 'text-emerald-600' : 'text-red-500')}>
            {result.isCorrect ? '정답' : '오답'} · 이 보기는 {result.isTrue ? '옳은 설명(O)' : '옳지 않은 설명(X)'}
          </p>
        )}
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            variant="ghost"
            aria-expanded={explanation.isOpen}
            onClick={() => void explanation.toggle()}
            className="h-11 md:h-8"
          >
            {explanation.isOpen ? '해설닫기' : '해설보기'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-expanded={isOpen}
            aria-controls={detailId}
            onClick={() => setIsOpen((open) => !open)}
            className="h-11 md:h-8"
          >
            {isOpen ? '문제닫기' : '문제보기'}
          </Button>
        </div>
      </div>
      {explanation.isOpen && (
        <div className="mt-2">
          <ExplanationPanel isLoading={explanation.isLoading} error={explanation.error} explanation={explanation.text} />
        </div>
      )}
      {isOpen && <OxQuestionDetail id={detailId} question={item.question} choiceIndex={item.choiceIndex} />}
    </li>
  )
}
