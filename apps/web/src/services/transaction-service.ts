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

export type FieldErrors = Partial<Record<"merchantName" | "cardBrand" | "status" | "amount" | "surcharge", string>>

export class ApiError extends Error {
  readonly status: number
  /** Per-field messages from a 400, to show under the matching inputs. */
  readonly fieldErrors: FieldErrors

  constructor(message: string, status: number, fieldErrors: FieldErrors = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

const toApiError = async (rsp: Response): Promise<ApiError> => {
  const body = await rsp.json().catch(() => null)
  return new ApiError(body?.error ?? `Request failed (${rsp.status})`, rsp.status, body?.fieldErrors)
}

// fetch() only rejects on network failure; a 4xx/5xx resolves normally, so check
// the status here and turn it into an error the UI can show.
export const getJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const rsp = await fetch(url, { signal })
  if (!rsp.ok) throw await toApiError(rsp)
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

export interface SurchargeConfig {
  defaultPercent: number
  maxPercent: number
  /** The common card-network cap; the form warns above it. */
  typicalCapPercent: number
}

export const SURCHARGE_CONFIG_URL = `${API_BASE}/surcharge-config`

// Money as decimal strings, exactly as entered, so it never passes through a float.
// Send exactly one of surchargePercent / surcharge: whichever the user typed last.
export interface NewTransactionInput {
  merchantName: string
  cardBrand: CardBrand
  status: TransactionStatus
  amount: string
  surchargePercent?: string
  surcharge?: string
}

/**
 * `idempotencyKey` stays the same for every retry of one submission, so if a request
 * times out after the server created the transaction, retrying returns that
 * transaction instead of creating a second one.
 */
export const createTransaction = async (input: NewTransactionInput, idempotencyKey: string): Promise<Transaction> => {
  const rsp = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  })
  if (!rsp.ok) throw await toApiError(rsp)
  return rsp.json()
}
