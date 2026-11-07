import { highlightTargetStore } from '@/lib/highlight-target.store'
import { useHighlightPattern } from '@/lib/use-highlight-pattern'

type HighlightedTextProps = {
  text: string
}

/** The text with every word from the learner's vocabulary marked, wherever it appears. */
export function HighlightedText({ text }: HighlightedTextProps) {
  const pattern = useHighlightPattern()
  if (!pattern) return <>{text}</>

  // With one capture group, split() puts the matches at the odd positions.
  return (
    <>
      {text.split(pattern).map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            data-term-mark
            title="눌러서 단어장에서 해제"
            // A tap opens the word's buttons right under it (no text selection needed).
            onClick={(event) => {
              event.stopPropagation() // inside an answer choice, the tap must not also pick the choice
              const box = event.currentTarget.getBoundingClientRect()
              highlightTargetStore.set({ term: part, anchor: { x: box.left + box.width / 2, y: box.bottom } })
            }}
            className="cursor-pointer rounded-sm bg-yellow-200 px-0.5 text-inherit"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}
