import type { CardBrand, Transaction, TransactionStatus } from "../models/transaction"

const API_BASE = "/api"

export interface TransactionPage {
  data: Transaction[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface TransactionSummary {
  /** Rows matching the search, any status. */
  count: number
  /** Sum of `total` over APPROVED matching rows, in dollars. */
  processedTotal: number
}

// Mirrors the API's SORT_FIELDS: every column the table shows.
export type SortField = "id" | "merchantName" | "cardBrand" | "amount" | "surcharge" | "total" | "status" | "createdAt"
export type SortOrder = "asc" | "desc"

// Which rows a request covers; the list and the summary take the same filters.
export interface Filters {
  q: string
  /** Empty = any brand. */
  cardBrands: CardBrand[]
  /** Empty = any status. */
  statuses: TransactionStatus[]
}

export interface ListParams extends Filters {
  page: number
  pageSize: number
  sort: SortField
  order: SortOrder
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// fetch() only rejects on network failure; a 4xx/5xx resolves normally, so check
// the status here and turn it into an error the UI can show.
export const getJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const rsp = await fetch(url, { signal })
  if (!rsp.ok) {
    const body = await rsp.json().catch(() => null)
    throw new ApiError(body?.error ?? `Request failed (${rsp.status})`, rsp.status)
  }
  return rsp.json()
}

const withQuery = (path: string, params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString()
  return qs ? `${path}?${qs}` : path
}

// Only the filters that are set, as API query params (?cardBrand=VISA,AMEX).
const filterParams = ({ q, cardBrands, statuses }: Filters): Record<string, string> => ({
  ...(q ? { q } : {}),
  ...(cardBrands.length ? { cardBrand: cardBrands.join(",") } : {}),
  ...(statuses.length ? { status: statuses.join(",") } : {}),
})

// URL builders, so a request is identified by its URL (used as the hook's cache key).
export const transactionsUrl = ({ page, pageSize, sort, order, ...filters }: ListParams): string =>
  withQuery(`${API_BASE}/transactions`, {
    page: String(page),
    pageSize: String(pageSize),
    ...filterParams(filters),
    sort,
    order,
  })

export const summaryUrl = (filters: Filters): string =>
  withQuery(`${API_BASE}/transactions/summary`, filterParams(filters))

export interface NewTransactionInput {
  merchantName: string
  cardBrand: CardBrand
  amount: number
}

export const createTransaction = async (input: NewTransactionInput): Promise<Transaction> => {
  const rsp = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  return rsp.json()
}
