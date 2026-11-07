import type { QuestionPublic } from '@/types/question.types'

const MIXED_SUBJECT = '감리 및 사업관리'
const AUDIT_SECTION = '감리'
const PROJECT_MANAGEMENT_SECTION = '사업관리'

/** Every section a note can belong to, in subject order. */
export const QUESTION_SECTIONS = ['감리', '사업관리', '소프트웨어 공학', '데이터베이스', '시스템 구조', '보안'] as const

function numberRange(first: number, last: number): ReadonlySet<number> {
  return new Set(Array.from({ length: last - first + 1 }, (_, offset) => first + offset))
}

/**
 * Numbers of the audit (감리) questions in each exam year. The rest of that subject is project management
 * (사업관리): it comes first in 2021-2023 and last in 2024-2025. The 2026 exam mixes the two, so its
 * audit questions (audit standards and guides, public-sector IT policy) are listed one by one.
 */
const AUDIT_NUMBERS_BY_YEAR: Record<number, ReadonlySet<number>> = {
  2021: numberRange(11, 25),
  2022: numberRange(11, 25),
  2023: numberRange(13, 25),
  2024: numberRange(1, 17),
  2025: numberRange(1, 19),
  2026: new Set([1, 2, 4, 5, 6, 7, 8, 13, 18, 19, 22, 24, 25]),
}

type SectionSource = Pick<QuestionPublic, 'subject' | 'year' | 'number'>

/** The subject, with "감리 및 사업관리" split into 감리 and 사업관리. */
export function getQuestionSection({ subject, year, number }: SectionSource): string {
  const auditNumbers = AUDIT_NUMBERS_BY_YEAR[year]
  if (subject !== MIXED_SUBJECT || !auditNumbers) return subject
  return auditNumbers.has(number) ? AUDIT_SECTION : PROJECT_MANAGEMENT_SECTION
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
