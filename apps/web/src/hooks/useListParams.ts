import { useCallback } from "react"
import { useSearchParams } from "react-router-dom"

import { CardBrand, TransactionStatus } from "../models/transaction"
import type { ListParams, SortField, SortOrder } from "../services/transaction-service"

export const DEFAULT_PAGE_SIZE = 25
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
export const DEFAULT_SORT: { sort: SortField; order: SortOrder } = { sort: "createdAt", order: "desc" }

const SORT_FIELDS: readonly SortField[] = [
  "id",
  "merchantName",
  "cardBrand",
  "amount",
  "surcharge",
  "total",
  "status",
  "createdAt",
]

const parsePage = (raw: string | null): number => {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

const parsePageSize = (raw: string | null): number => {
  const n = Number(raw)
  return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE
}

const parseSort = (raw: string | null): SortField =>
  SORT_FIELDS.includes(raw as SortField) ? (raw as SortField) : DEFAULT_SORT.sort

const parseOrder = (raw: string | null): SortOrder => (raw === "asc" || raw === "desc" ? raw : DEFAULT_SORT.order)

export const CARD_BRANDS = Object.values(CardBrand)
export const STATUSES = Object.values(TransactionStatus)

// "VISA,AMEX" → [VISA, AMEX], in canonical order; unknown values in a hand-edited URL
// are dropped. Selecting every option isn't collapsed to "no filter": that would make
// the last checkbox you tick clear them all, and the rows are the same either way.
export const parseEnumList = <T extends string>(raw: string | null, allowed: readonly T[]): T[] => {
  const wanted = new Set((raw ?? "").split(","))
  return allowed.filter((v) => wanted.has(v))
}

const readParams = (sp: URLSearchParams): ListParams => ({
  page: parsePage(sp.get("page")),
  pageSize: parsePageSize(sp.get("pageSize")),
  q: (sp.get("q") ?? "").trim(),
  cardBrands: parseEnumList(sp.get("cardBrand"), CARD_BRANDS),
  statuses: parseEnumList(sp.get("status"), STATUSES),
  sort: parseSort(sp.get("sort")),
  order: parseOrder(sp.get("order")),
})

/** True when nothing differs from how the dashboard first loads. */
export const isDefaultView = (p: ListParams): boolean =>
  !p.q &&
  p.cardBrands.length === 0 &&
  p.statuses.length === 0 &&
  p.page === 1 &&
  p.pageSize === DEFAULT_PAGE_SIZE &&
  p.sort === DEFAULT_SORT.sort &&
  p.order === DEFAULT_SORT.order

// Page, page size, search, filters and sort live in the URL
// (?q=blue&cardBrand=VISA,AMEX&status=APPROVED&page=3&sort=amount&order=desc), so
// refresh, back/forward and shared links all restore the same view. Anything
// malformed in a hand-edited URL falls back to the default instead of erroring.
export const useListParams = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const params = readParams(searchParams)

  // Defaults are left out so the plain dashboard URL stays "/".
  // `replace` is for changes that shouldn't each create a history entry (typing).
  const setParams = useCallback(
    (next: Partial<ListParams>, { replace = false } = {}) => {
      setSearchParams(
        (current) => {
          const merged = { ...readParams(current), ...next }
          const cardBrands = parseEnumList(merged.cardBrands.join(","), CARD_BRANDS)
          const statuses = parseEnumList(merged.statuses.join(","), STATUSES)
          const out = new URLSearchParams()
          if (merged.q) out.set("q", merged.q)
          if (cardBrands.length) out.set("cardBrand", cardBrands.join(","))
          if (statuses.length) out.set("status", statuses.join(","))
          if (merged.page !== 1) out.set("page", String(merged.page))
          if (merged.pageSize !== DEFAULT_PAGE_SIZE) out.set("pageSize", String(merged.pageSize))
          if (merged.sort !== DEFAULT_SORT.sort || merged.order !== DEFAULT_SORT.order) {
            out.set("sort", merged.sort)
            out.set("order", merged.order)
          }
          return out
        },
        { replace },
      )
    },
    [setSearchParams],
  )

  // Back to exactly how the dashboard loads. Pushes history, so Back restores the
  // filters that were just cleared.
  const resetParams = useCallback(() => setSearchParams(new URLSearchParams()), [setSearchParams])

  return [params, setParams, resetParams] as const
}
