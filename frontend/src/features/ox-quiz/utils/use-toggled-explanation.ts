import { useCallback, useState } from 'react'

/** Open/close state for an explanation that is loaded on first open and kept afterwards. */
export function useToggledExplanation(load: () => Promise<string>) {
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback(async () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    setIsOpen(true)
    if (text !== null || isLoading) return
    setIsLoading(true)
    setError(null)
    try {
      setText(await load())
    } catch {
      setError('해설을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }, [isOpen, text, isLoading, load])

  return { isOpen, text, isLoading, error, toggle }
}
