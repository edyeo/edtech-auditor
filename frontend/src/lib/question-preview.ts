import type { QuestionPublic } from '@/types/question.types'

/** One-line preview for list rows: first stem line, or a hint when the question is a figure. */
export function previewStem(question: QuestionPublic): string {
  const firstLine = question.stem.split('\n')[0].trim()
  return question.image_url ? `[그림 포함] ${firstLine}` : firstLine
}
