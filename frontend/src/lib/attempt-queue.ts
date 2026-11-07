import { getAccessToken, getUserId } from '@/lib/auth-token'
import type { WireReview } from '@/lib/learner.api'

// Answers are graded in the browser and sent to the server in batches: every FLUSH_AFTER_MS, as soon as
// FLUSH_AT_COUNT of them wait, and when the page is hidden or closed. What has not been sent yet is kept in
// localStorage, so closing the tab or losing the connection loses nothing.
const FLUSH_AFTER_MS = 30_000
const FLUSH_AT_COUNT = 10
const RETRY_AFTER_MS = 60_000
const MAX_PER_BATCH = 200
const STORAGE_PREFIX = 'edtech:attempt-queue:v1:'

export type QueuedAttempt =
  | { kind: 'question'; id: string; question_id: string; selected_index: number }
  | { kind: 'ox'; id: string; question_id: string; statement_index: number; answer: 'O' | 'X' }

type Queue = { attempts: QueuedAttempt[]; review: Record<string, WireReview> }

let owner: string | null = null
// The token of the last send: a request made while the page is closing cannot wait for a fresh one.
let cachedToken: string | null = null
let queue: Queue = { attempts: [], review: {} }
let timer: ReturnType<typeof setTimeout> | null = null
let isFlushing = false

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function persist(): void {
  if (!owner) return
  try {
    if (queue.attempts.length === 0 && Object.keys(queue.review).length === 0) localStorage.removeItem(storageKey(owner))
    else localStorage.setItem(storageKey(owner), JSON.stringify(queue))
  } catch {
    // Storage full or blocked: the queue still works in memory.
  }
}

function load(userId: string): Queue {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) ?? 'null') as Queue | null
    if (parsed && Array.isArray(parsed.attempts) && parsed.review && typeof parsed.review === 'object') return parsed
  } catch {
    // A damaged entry is ignored.
  }
  return { attempts: [], review: {} }
}

/** Tell the queue whose answers it holds; a different account gets its own saved queue. */
export async function setQueueOwner(): Promise<void> {
  const userId = await getUserId()
  cachedToken = await getAccessToken()
  if (userId === owner) return
  persist() // the previous account's unsent answers stay under its own key
  const carried = owner === null ? queue : { attempts: [], review: {} } // answers given before the account was known
  owner = userId
  const saved = userId ? load(userId) : { attempts: [], review: {} }
  queue = { attempts: [...saved.attempts, ...carried.attempts], review: { ...saved.review, ...carried.review } }
  persist()
}

function schedule(delay: number): void {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    void flushAttemptQueue()
  }, delay)
}

/** Add one graded answer to the queue. */
export function enqueueAttempt(attempt: QueuedAttempt): void {
  queue.attempts.push(attempt)
  persist()
  if (queue.attempts.length >= FLUSH_AT_COUNT) void flushAttemptQueue()
  else schedule(FLUSH_AFTER_MS)
}

/** Remember the latest review box of a question (the last one wins). */
export function enqueueReview(questionId: string, review: WireReview): void {
  queue.review[questionId] = review
  persist()
  schedule(FLUSH_AFTER_MS)
}

export function hasPendingAttempts(): boolean {
  return queue.attempts.length > 0 || Object.keys(queue.review).length > 0
}

type FlushOptions = { keepalive?: boolean }

/** Send what is waiting. Resolves when done; a failed send keeps everything and tries again later. */
export async function flushAttemptQueue({ keepalive = false }: FlushOptions = {}): Promise<void> {
  if (isFlushing || !hasPendingAttempts()) return
  const token = keepalive && cachedToken ? cachedToken : await getAccessToken()
  cachedToken = token
  if (!token) return
  isFlushing = true
  try {
    for (;;) {
      const attempts = queue.attempts.slice(0, MAX_PER_BATCH)
      const questionIds = new Set(attempts.map((attempt) => attempt.question_id))
      const review = Object.fromEntries(Object.entries(queue.review).filter(([id]) => questionIds.has(id) || attempts.length === 0))
      if (attempts.length === 0 && Object.keys(review).length === 0) break

      const response = await fetch('/api/learner/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ attempts, review }),
        keepalive,
      })
      if (response.status === 401) return // signed out for now: the queue stays until the next sign-in
      if (!response.ok && response.status < 500) {
        // The server refuses this batch for good (e.g. a question that no longer exists): drop it so it
        // does not block the answers behind it.
        console.warn('answers batch refused', response.status)
      } else if (!response.ok) {
        throw new Error(`answers batch failed (${response.status})`)
      }
      const sent = new Set(attempts.map((attempt) => attempt.id))
      queue.attempts = queue.attempts.filter((attempt) => !sent.has(attempt.id))
      for (const [id, sentReview] of Object.entries(review)) {
        if (queue.review[id] === sentReview) delete queue.review[id]
      }
      persist()
      if (queue.attempts.length === 0 && Object.keys(queue.review).length === 0) break
    }
  } catch {
    schedule(RETRY_AFTER_MS)
  } finally {
    isFlushing = false
  }
}

// Send what is waiting when the page goes away (keepalive lets the request outlive it).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushAttemptQueue({ keepalive: true })
  })
  window.addEventListener('pagehide', () => void flushAttemptQueue({ keepalive: true }))
}
