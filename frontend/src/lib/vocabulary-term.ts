/** Shortest and longest word that can be saved (the server allows 1-100). */
export const MIN_TERM_LENGTH = 2
export const MAX_TERM_LENGTH = 100

/** Runs of whitespace (including line breaks from a multi-line selection) become one space. */
export function normalizeTerm(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/** The identity of a term: "Critical Path" and "critical  path" are one word. */
export function termKey(term: string): string {
  return normalizeTerm(term).toLowerCase()
}

export function isSavableTerm(term: string): boolean {
  return term.length >= MIN_TERM_LENGTH && term.length <= MAX_TERM_LENGTH
}
