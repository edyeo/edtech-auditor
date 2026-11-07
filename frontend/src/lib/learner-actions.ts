import { importLocalLearnerDataOnce } from '@/lib/import-local-learner-data'
import {
  LearnerApiError,
  deleteChoiceMark,
  deleteMark,
  deleteOxMark,
  deleteVocabularyImage,
  deleteVocabularyTerm,
  fetchLearnerState,
  fetchMiniTests,
  postAttempt,
  patchVocabularyTerm,
  postMiniTest,
  postVocabularyImage,
  postVocabularyTerm,
  putChoiceMark,
  putMark,
  putOxMark,
  putReview,
} from '@/lib/learner.api'
import { INITIAL_LEARNER_STATE, learnerStore, type LearnerState } from '@/lib/learner-state.store'
import type {
  MiniTestRecord,
  OxStats,
  QuestionMark,
  QuestionMarkMap,
  ReviewState,
  VocabularyImage,
} from '@/types/learner.types'
import { termKey } from '@/lib/vocabulary-term'
import type { AnswerCheckResponse } from '@/types/question.types'

function notify(message: string): void {
  learnerStore.update((state) => ({ ...state, notice: message }))
}

/** Forget the previous account's data (sign-out / account switch) so it never shows for the next user. */
export function resetLearnerState(): void {
  learnerStore.update(() => INITIAL_LEARNER_STATE)
}

export function dismissLearnerNotice(): void {
  learnerStore.update((state) => ({ ...state, notice: null }))
}

let hydrating: Promise<void> | null = null

/** Load the learner's server-side data into the in-memory store (also retries after an error). */
export function hydrateLearnerState(): Promise<void> {
  // Callers racing (React StrictMode double effect, quick retry clicks) share one load.
  hydrating ??= loadLearnerState().finally(() => {
    hydrating = null
  })
  return hydrating
}

async function loadLearnerState(): Promise<void> {
  learnerStore.update((state) => ({ ...state, status: 'loading', error: null }))
  try {
    await importLocalLearnerDataOnce()
    const [state, history] = await Promise.all([fetchLearnerState(), fetchMiniTests()])
    learnerStore.update((current) => ({ ...current, ...state, history, status: 'ready', error: null }))
  } catch {
    learnerStore.update((state) => ({
      ...state,
      status: 'error',
      error: '학습 기록을 불러오지 못했습니다. 서버나 데이터베이스 연결을 확인해 주세요.',
    }))
  }
}

// Marker edits are sent as "set the count to N". Taps are coalesced per key: while a request is
// in flight only the latest wanted count is remembered and sent next, so quick taps cannot land out of
// order and an older response never overwrites a newer tap.
const wantedMarkCounts = new Map<string, number>()
const flushingMarks = new Set<string>()

/** Where one kind of marker (on a question, or on an O/X statement) lives and how it is saved. */
type MarkChannel = {
  read: (state: LearnerState) => QuestionMarkMap
  write: (state: LearnerState, marks: QuestionMarkMap) => LearnerState
  save: (key: string, count: number) => Promise<QuestionMark>
  /** Remove every marker of the key; may update other state the server returns with it. */
  remove: (key: string) => Promise<void>
}

const QUESTION_MARKS: MarkChannel = {
  read: (state) => state.marks,
  write: (state, marks) => ({ ...state, marks }),
  save: putMark,
  remove: async (questionId) => {
    const stats = await deleteMark(questionId)
    if (stats) learnerStore.update((s) => ({ ...s, stats: { ...s.stats, [questionId]: stats } }))
  },
}

const OX_STATEMENT_MARKS: MarkChannel = {
  read: (state) => state.oxMarks,
  write: (state, oxMarks) => ({ ...state, oxMarks }),
  save: putOxMark,
  remove: deleteOxMark,
}

const CHOICE_MARKS: MarkChannel = {
  read: (state) => state.choiceMarks,
  write: (state, choiceMarks) => ({ ...state, choiceMarks }),
  save: putChoiceMark,
  remove: deleteChoiceMark,
}

/** Marker box +/- buttons of one answer choice, keyed "question_id#choice_index". */
export function setChoiceMarkCount(choiceKey: string, count: number): void {
  setMarkCount(CHOICE_MARKS, choiceKey, count)
}

/** Marker box +/- buttons of a question. Optimistic: the UI changes at once and rolls back if the server refuses. */
export function setQuestionMarkCount(questionId: string, count: number): void {
  setMarkCount(QUESTION_MARKS, questionId, count)
}

/** Marker box +/- buttons of one O/X statement, keyed "question_id#statement_index". */
export function setOxStatementMarkCount(statementKey: string, count: number): void {
  setMarkCount(OX_STATEMENT_MARKS, statementKey, count)
}

function setMarkCount(channel: MarkChannel, key: string, count: number): void {
  const before = learnerStore.getSnapshot()
  const next = Math.min(Math.max(count, 0), before.maxMarkCount)
  const confirmedMark = channel.read(before)[key]
  if (next === (confirmedMark?.count ?? 0) && !flushingMarks.has(key)) return

  wantedMarkCounts.set(key, next)
  learnerStore.update((s) => channel.write(s, withMarkCount(channel.read(s), key, next)))
  void flushMarkCount(channel, key, confirmedMark)
}

function withMarkCount(marks: QuestionMarkMap, key: string, count: number): QuestionMarkMap {
  if (count === 0) {
    const { [key]: _removed, ...rest } = marks
    return rest
  }
  const existing = marks[key]
  return {
    ...marks,
    [key]: existing ? { ...existing, count } : { markedAt: new Date().toISOString(), source: 'manual', count },
  }
}

async function flushMarkCount(
  channel: MarkChannel,
  key: string,
  confirmedMark: QuestionMark | undefined,
): Promise<void> {
  if (flushingMarks.has(key)) return
  flushingMarks.add(key)
  let confirmed = confirmedMark
  try {
    for (;;) {
      const wanted = wantedMarkCounts.get(key) ?? 0
      if (wanted === 0) {
        if (confirmed) await channel.remove(key)
        confirmed = undefined
      } else if (wanted !== confirmed?.count) {
        confirmed = await channel.save(key, wanted)
      }
      if ((wantedMarkCounts.get(key) ?? 0) === wanted) break
    }
    if (confirmed) {
      const mark = confirmed
      learnerStore.update((s) => channel.write(s, { ...channel.read(s), [key]: mark }))
    }
  } catch {
    learnerStore.update((s) =>
      channel.write(s, confirmed ? { ...channel.read(s), [key]: confirmed } : withMarkCount(channel.read(s), key, 0)),
    )
    notify('마커를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  } finally {
    wantedMarkCounts.delete(key)
    flushingMarks.delete(key)
  }
}

/** Save a selected word. Resolves to false (with a notice) when it could not be saved. */
export async function saveVocabularyTerm(
  term: string,
  sourceQuestionId: string | null,
  section: string | null = null,
): Promise<boolean> {
  try {
    const saved = await postVocabularyTerm(term, sourceQuestionId, section)
    learnerStore.update((s) => ({ ...s, vocabulary: { ...s.vocabulary, [termKey(saved.term)]: saved } }))
    return true
  } catch (error) {
    const isFull = error instanceof LearnerApiError && error.status === 409
    notify(isFull ? '단어장이 가득 찼습니다. 쓰지 않는 단어를 지우고 다시 저장해 주세요.' : '단어를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    return false
  }
}

/** Change a saved word's memo or studied flag. Optimistic; a failed save restores the old values. */
export async function updateVocabularyTerm(
  term: string,
  change: { memo?: string; studied?: boolean; section?: string | null },
): Promise<void> {
  const key = termKey(term)
  const before = learnerStore.getSnapshot().vocabulary[key]
  if (!before) return
  learnerStore.update((s) => ({ ...s, vocabulary: { ...s.vocabulary, [key]: { ...before, ...change } } }))
  try {
    // An empty section clears it on the server.
    await patchVocabularyTerm(before.term, { ...change, section: change.section === undefined ? undefined : (change.section ?? '') })
  } catch {
    learnerStore.update((s) => (s.vocabulary[key] ? { ...s, vocabulary: { ...s.vocabulary, [key]: before } } : s))
    notify('단어장을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

/** Compressed upload of a picture for a note. Resolves to the new image, or null (with a notice) on failure. */
export async function addVocabularyImage(term: string, image: Blob): Promise<VocabularyImage | null> {
  const key = termKey(term)
  try {
    const saved = await postVocabularyImage(learnerStore.getSnapshot().vocabulary[key]?.term ?? term, image)
    learnerStore.update((s) =>
      s.vocabulary[key]
        ? { ...s, vocabulary: { ...s.vocabulary, [key]: { ...s.vocabulary[key], images: [...s.vocabulary[key].images, saved] } } }
        : s,
    )
    return saved
  } catch (error) {
    const status = error instanceof LearnerApiError ? error.status : 0
    notify(
      status === 409
        ? '이미지는 노트당 3장, 전체 20MB까지 올릴 수 있습니다.'
        : '이미지를 올리지 못했습니다. 잠시 후 다시 시도해 주세요.',
    )
    return null
  }
}

export async function removeVocabularyImage(term: string, imageId: string): Promise<void> {
  const key = termKey(term)
  try {
    await deleteVocabularyImage(imageId)
    learnerStore.update((s) =>
      s.vocabulary[key]
        ? {
            ...s,
            vocabulary: {
              ...s.vocabulary,
              [key]: { ...s.vocabulary[key], images: s.vocabulary[key].images.filter((image) => image.id !== imageId) },
            },
          }
        : s,
    )
  } catch {
    notify('이미지를 지우지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

/** Remove a saved word. Optimistic; a failed delete brings it back. */
export async function removeVocabularyTerm(term: string): Promise<void> {
  const key = termKey(term)
  const before = learnerStore.getSnapshot().vocabulary[key]
  if (!before) return
  learnerStore.update((s) => {
    const { [key]: _removed, ...rest } = s.vocabulary
    return { ...s, vocabulary: rest }
  })
  try {
    await deleteVocabularyTerm(before.term)
  } catch {
    learnerStore.update((s) => ({ ...s, vocabulary: { ...s.vocabulary, [key]: before } }))
    notify('단어를 지우지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

/** Grade + record one answer on the server (updates stats and may auto-mark). Throws on failure. */
export async function submitAttempt(
  questionId: string,
  selectedIndex: number,
): Promise<{ check: AnswerCheckResponse; autoMarked: boolean }> {
  const result = await postAttempt(questionId, selectedIndex)
  learnerStore.update((s) => ({
    ...s,
    stats: { ...s.stats, [questionId]: result.stats },
    marks: result.mark ? { ...s.marks, [questionId]: result.mark } : s.marks,
  }))
  return { check: result.check, autoMarked: result.autoMarked }
}

/** Store the new answer counts of an O/X statement (the server returns them with the verdict). */
export function recordOxStats(statementKey: string, stats: OxStats): void {
  learnerStore.update((s) => ({ ...s, oxStats: { ...s.oxStats, [statementKey]: stats } }))
}

/** Save a question's review box. Optimistic; a failed save only shows a notice. */
export async function saveReviewState(questionId: string, state: ReviewState): Promise<void> {
  learnerStore.update((s) => ({ ...s, review: { ...s.review, [questionId]: state } }))
  try {
    await putReview(questionId, state)
  } catch {
    notify('복습 일정을 저장하지 못했습니다. 이 문제의 복습 간격이 반영되지 않았을 수 있어요.')
  }
}

/** Grade + record a whole mini test on the server. Throws on failure (nothing is recorded then). */
export async function submitMiniTest(
  scopeLabel: string,
  answers: { questionId: string; selectedIndex: number }[],
): Promise<{ record: MiniTestRecord; autoMarkedIds: string[] }> {
  const result = await postMiniTest(scopeLabel, answers)
  learnerStore.update((s) => ({
    ...s,
    stats: { ...s.stats, ...result.stats },
    marks: { ...s.marks, ...result.marks },
    history: [result.record, ...s.history].slice(0, 100),
  }))
  return { record: result.record, autoMarkedIds: result.autoMarkedIds }
}
