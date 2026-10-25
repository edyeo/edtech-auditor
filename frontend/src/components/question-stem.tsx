type QuestionStemProps = {
  stem: string
  imageUrl: string | null
}

export function QuestionStem({ stem, imageUrl }: QuestionStemProps) {
  if (imageUrl) {
    return <img src={imageUrl} alt={stem} className="w-full rounded-md border bg-white" />
  }

  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{stem}</p>
}
