const STORAGE_KEY = 'learner-id'

let fallbackId: string | undefined

/**
 * Anonymous learner identity (no accounts yet): a UUID kept in this browser and sent as
 * `X-Learner-Id`. Copying the value to another browser's localStorage continues the same history.
 */
export function getLearnerId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, created)
    return created
  } catch {
    // localStorage blocked (e.g. private mode): use an id for this page load only.
    fallbackId ??= crypto.randomUUID()
    return fallbackId
  }
}
