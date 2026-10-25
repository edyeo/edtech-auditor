import { useEffect, useState } from 'react'
import { fetchQuestions } from '@/lib/questions.api'
import type { QuestionPublic } from '@/types/question.types'

let bankPromise: Promise<QuestionPublic[]> | null = null

// One fetch shared by every screen; a failed load is retried on the next mount.
function loadQuestionBank(): Promise<QuestionPublic[]> {
  bankPromise ??= fetchQuestions().catch((error) => {
    bankPromise = null
    throw error
  })
  return bankPromise
}

type QuestionBankState = { questions: QuestionPublic[]; isLoading: boolean; error: string | null }

export function useQuestionBank(): QuestionBankState {
  const [state, setState] = useState<QuestionBankState>({ questions: [], isLoading: true, error: null })

  useEffect(() => {
    let alive = true
    loadQuestionBank()
      .then((questions) => alive && setState({ questions, isLoading: false, error: null }))
      .catch(() => alive && setState({ questions: [], isLoading: false, error: '문제 목록을 불러오지 못했습니다.' }))
    return () => {
      alive = false
    }
  }, [])

  return state
}
