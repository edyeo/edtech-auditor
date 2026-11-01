import { useCallback } from 'react'
import { ExplanationPanel } from '@/components/explanation-panel'
import { QuestionChoiceReadout } from '@/components/question-choice-readout'
import { QuestionStem } from '@/components/question-stem'
import { Button } from '@/components/ui/button'
import { useToggledExplanation } from '@/features/ox-quiz/utils/use-toggled-explanation'
import { explainAnswer } from '@/lib/questions.api'
import { getQuestionSection } from '@/lib/question-section'
import type { QuestionPublic } from '@/types/question.types'

type OxQuestionDetailProps = {
  id: string
  question: QuestionPublic
  /** The choice that is being played as a statement, highlighted among the full choice list; null if none. */
  choiceIndex: number | null
}

/** The whole original question: exam year, stem, every choice and the explanation of its answer. */
export function OxQuestionDetail({ id, question, choiceIndex }: OxQuestionDetailProps) {
  const loadAnswerExplanation = useCallback(async () => (await explainAnswer(question.id)).explanation, [question.id])
  const answerExplanation = useToggledExplanation(loadAnswerExplanation)

  return (
    <div id={id} className="mt-3 flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">
        {question.year}년 {question.round}회 {question.number}번 · {getQuestionSection(question)}
      </p>
      <QuestionStem stem={question.stem} imageUrl={question.image_url} />
      <QuestionChoiceReadout choices={question.choices} highlightIndex={choiceIndex} highlightLabel="이 보기" />
      <Button
        type="button"
        variant="outline"
        aria-expanded={answerExplanation.isOpen}
        className="h-11 self-start md:h-8"
        onClick={() => void answerExplanation.toggle()}
      >
        {answerExplanation.isOpen ? '정답 해설 닫기' : '정답 해설 보기'}
      </Button>
      {answerExplanation.isOpen && (
        <ExplanationPanel
          isLoading={answerExplanation.isLoading}
          error={answerExplanation.error}
          explanation={answerExplanation.text}
        />
      )}
    </div>
  )
}
