import { Button } from '@/components/ui/button'

type QuestionListPagerProps = {
  page: number
  pageCount: number
  onChange: (page: number) => void
}

export function QuestionListPager({ page, pageCount, onChange }: QuestionListPagerProps) {
  if (pageCount <= 1) return null

  return (
    <nav aria-label="페이지 이동" className="flex items-center justify-center gap-3 pt-2">
      <Button type="button" variant="outline" className="h-11 md:h-8" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        이전
      </Button>
      <span aria-live="polite" className="min-w-16 text-center text-sm text-muted-foreground">
        {page} / {pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        className="h-11 md:h-8"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        다음
      </Button>
    </nav>
  )
}
