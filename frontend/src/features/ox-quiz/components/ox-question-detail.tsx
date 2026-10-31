import { QuestionChoiceReadout } from '@/components/question-choice-readout'
import { QuestionStem } from '@/components/question-stem'
import { getQuestionSection } from '@/lib/question-section'
import type { QuestionPublic } from '@/types/question.types'

type OxQuestionDetailProps = {
  id: string
  question: QuestionPublic
  /** The choice that is being played as a statement, highlighted among the full choice list; null if none. */
  choiceIndex: number | null
}

/** The whole original question: exam year, stem and every choice. */
export function OxQuestionDetail({ id, question, choiceIndex }: OxQuestionDetailProps) {
  return (
    <div id={id} className="mt-3 flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">
        {question.year}년 {question.round}회 {question.number}번 · {getQuestionSection(question)}
      </p>
      <QuestionStem stem={question.stem} imageUrl={question.image_url} />
      <QuestionChoiceReadout choices={question.choices} highlightIndex={choiceIndex} highlightLabel="이 보기" />
    </div>
  )
}
