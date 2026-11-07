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
          <mark key={index} className="rounded-sm bg-yellow-200 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}
