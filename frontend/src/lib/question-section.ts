import type { QuestionPublic } from '@/types/question.types'

const MIXED_SUBJECT = '감리 및 사업관리'
const AUDIT_SECTION = '감리'
const PROJECT_MANAGEMENT_SECTION = '사업관리'

/**
 * Numbers of the audit (감리) questions in each exam year. The rest of that subject is project management
 * (사업관리): it comes first in 2021-2023 and last in 2024-2025.
 */
const AUDIT_NUMBERS_BY_YEAR: Record<number, readonly [first: number, last: number]> = {
  2021: [11, 25],
  2022: [11, 25],
  2023: [13, 25],
  2024: [1, 17],
  2025: [1, 19],
}

type SectionSource = Pick<QuestionPublic, 'subject' | 'year' | 'number'>

/** The subject, with "감리 및 사업관리" split into 감리 and 사업관리. */
export function getQuestionSection({ subject, year, number }: SectionSource): string {
  const auditNumbers = AUDIT_NUMBERS_BY_YEAR[year]
  if (subject !== MIXED_SUBJECT || !auditNumbers) return subject
  const [first, last] = auditNumbers
  return number >= first && number <= last ? AUDIT_SECTION : PROJECT_MANAGEMENT_SECTION
}

/** Sections in subject order, for a filter list. */
export function listQuestionSections(questions: SectionSource[]): string[] {
  const subjects = new Set(questions.map((question) => question.subject))
  const sections = new Set(
    [...subjects].flatMap((subject) =>
      subject === MIXED_SUBJECT ? [AUDIT_SECTION, PROJECT_MANAGEMENT_SECTION] : [subject],
    ),
  )
  // Years without a known split keep the combined subject, so it stays selectable.
  for (const question of questions) sections.add(getQuestionSection(question))
  return [...sections]
}
