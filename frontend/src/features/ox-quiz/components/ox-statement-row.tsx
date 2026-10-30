import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { OxQuestionDetail } from '@/features/ox-quiz/components/ox-question-detail'
import type { OxAnswer, OxItem, OxResult } from '@/features/ox-quiz/types/ox-quiz.types'
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

  return (
    <li className="border-b py-3 last:border-b-0">
      <p className="text-base leading-relaxed md:text-sm">{item.statement}</p>
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
        <Button
          type="button"
          variant="ghost"
          aria-expanded={isOpen}
          aria-controls={detailId}
          onClick={() => setIsOpen((open) => !open)}
          className="ml-auto h-11 md:h-8"
        >
          문제보기
        </Button>
      </div>
      {isOpen && <OxQuestionDetail id={detailId} question={item.question} choiceIndex={item.choiceIndex} />}
    </li>
  )
}
