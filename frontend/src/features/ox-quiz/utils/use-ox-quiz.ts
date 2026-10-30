import { useEffect, useMemo, useRef, useState } from 'react'
import type { OxAnswer, OxFilter, OxItem, OxResult, OxStatement } from '@/features/ox-quiz/types/ox-quiz.types'
import { buildOxItems } from '@/features/ox-quiz/utils/build-ox-items'
import { DEFAULT_OX_FILTER, filterOxItems } from '@/features/ox-quiz/utils/filter-ox-items'
import { checkOxStatement, fetchOxStatements } from '@/features/ox-quiz/utils/ox-quiz.api'
import { shuffleItems } from '@/features/ox-quiz/utils/shuffle-items'
import { useQuestionBank } from '@/lib/use-question-bank'

const PAGE_SIZE = 20

let statementsPromise: Promise<OxStatement[]> | null = null

// One fetch for the whole session; a failed load is retried on the next mount.
function loadStatements(): Promise<OxStatement[]> {
  statementsPromise ??= fetchOxStatements().catch((error) => {
    statementsPromise = null
    throw error
  })
  return statementsPromise
}

export function useOxQuiz() {
  const bank = useQuestionBank()
  const [statements, setStatements] = useState<OxStatement[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reshuffled, setReshuffled] = useState<OxItem[] | null>(null)
  const [filter, setFilter] = useState<OxFilter>(DEFAULT_OX_FILTER)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [results, setResults] = useState<Record<string, OxResult>>({})
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(new Set())
  const [answerError, setAnswerError] = useState<string | null>(null)
  const roundRef = useRef(0)

  useEffect(() => {
    let alive = true
    loadStatements()
      .then((loaded) => alive && setStatements(loaded))
      .catch(() => alive && setLoadError('O/X 문제를 불러오지 못했습니다.'))
    return () => {
      alive = false
    }
  }, [])

  const items = useMemo(
    () => (statements ? buildOxItems(bank.questions, statements) : []),
    [bank.questions, statements],
  )
  const initialOrder = useMemo(() => shuffleItems(items), [items])
  const ordered = reshuffled ?? initialOrder
  const filtered = useMemo(() => filterOxItems(ordered, filter), [ordered, filter])

  const years = useMemo(() => [...new Set(items.map((item) => item.question.year))].sort((a, b) => b - a), [items])
  const subjects = useMemo(() => [...new Set(items.map((item) => item.question.subject))], [items])

  function updateFilter(patch: Partial<OxFilter>) {
    setFilter((current) => ({ ...current, ...patch }))
    setVisibleCount(PAGE_SIZE)
  }

  async function answer(item: OxItem, choice: OxAnswer) {
    if (results[item.key] || pendingKeys.has(item.key)) return
    const round = roundRef.current
    setAnswerError(null)
    setPendingKeys((current) => new Set(current).add(item.key))
    try {
      const verdict = await checkOxStatement(item.question.id, item.statementIndex, choice)
      if (round !== roundRef.current) return
      setResults((current) => ({
        ...current,
        [item.key]: { answer: choice, isTrue: verdict.is_true, isCorrect: verdict.is_correct },
      }))
    } catch {
      if (round === roundRef.current) setAnswerError('채점하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setPendingKeys((current) => {
        const next = new Set(current)
        next.delete(item.key)
        return next
      })
    }
  }

  /** New random order, and start the score over. */
  function reshuffle() {
    roundRef.current += 1
    setReshuffled(shuffleItems(items))
    setResults({})
    setVisibleCount(PAGE_SIZE)
    setAnswerError(null)
  }

  const answeredResults = Object.values(results)

  return {
    isLoading: bank.isLoading || (statements === null && loadError === null),
    error: bank.error ?? loadError,
    years,
    subjects,
    filter,
    updateFilter,
    totalCount: filtered.length,
    visibleItems: filtered.slice(0, visibleCount),
    hasMore: filtered.length > visibleCount,
    showMore: () => setVisibleCount((count) => count + PAGE_SIZE),
    results,
    pendingKeys,
    answerError,
    answer,
    reshuffle,
    answeredCount: answeredResults.length,
    correctCount: answeredResults.filter((result) => result.isCorrect).length,
  }
}
