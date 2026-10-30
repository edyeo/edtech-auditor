type QuestionStemProps = {
  stem: string
  imageUrl: string | null
}

export function QuestionStem({ stem, imageUrl }: QuestionStemProps) {
  if (imageUrl) {
    return <img src={imageUrl} alt={stem} className="w-full rounded-md border bg-white" />
  }

  return <p className="text-base leading-relaxed whitespace-pre-wrap md:text-sm">{stem}</p>
}
