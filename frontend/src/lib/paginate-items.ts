export type Page<T> = {
  items: T[]
  /** 1-based and clamped into range, so a shrinking list never leaves an empty page behind. */
  page: number
  pageCount: number
}

export function paginateItems<T>(items: T[], requestedPage: number, pageSize: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageCount }
}
