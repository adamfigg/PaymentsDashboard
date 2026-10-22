import { useCallback } from "react"
import { useSearchParams } from "react-router-dom"

import type { ListParams } from "../services/transaction-service"

export const DEFAULT_PAGE_SIZE = 25
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const parsePage = (raw: string | null): number => {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

const parsePageSize = (raw: string | null): number => {
  const n = Number(raw)
  return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE
}

// Page, page size and search live in the URL (?q=blue&page=3&pageSize=50), so
// refresh, back/forward and shared links all restore the same view. Anything
// malformed in a hand-edited URL falls back to the default instead of erroring.
export const useListParams = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const params: ListParams = {
    page: parsePage(searchParams.get("page")),
    pageSize: parsePageSize(searchParams.get("pageSize")),
    q: (searchParams.get("q") ?? "").trim(),
  }

  // Defaults are left out so the plain dashboard URL stays "/".
  // `replace` is for changes that shouldn't each create a history entry (typing).
  const setParams = useCallback(
    (next: Partial<ListParams>, { replace = false } = {}) => {
      setSearchParams(
        (current) => {
          const merged = {
            page: parsePage(current.get("page")),
            pageSize: parsePageSize(current.get("pageSize")),
            q: current.get("q") ?? "",
            ...next,
          }
          const out = new URLSearchParams()
          if (merged.q) out.set("q", merged.q)
          if (merged.page !== 1) out.set("page", String(merged.page))
          if (merged.pageSize !== DEFAULT_PAGE_SIZE) out.set("pageSize", String(merged.pageSize))
          return out
        },
        { replace },
      )
    },
    [setSearchParams],
  )

  return [params, setParams] as const
}
