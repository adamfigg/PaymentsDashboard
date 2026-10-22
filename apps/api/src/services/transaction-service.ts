import { TransactionStatus } from "../models/transaction.js"
import { CardBrand } from "../models/transaction.js"
import type { Transaction } from "../models/transaction.js"
import { loadTransactions } from "../data/transactions.js"
import { fromCents, toCents } from "../utils/money.js"

export interface TransactionSummary {
  /** Rows matching the search, any status; equals the list's `total`. */
  count: number
  /** Sum of `total` (amount + surcharge) over APPROVED matching rows, in dollars. */
  processedTotal: number
}

export interface NewTransactionInput {
  merchantName: string
  cardBrand: CardBrand
  amount: number
}

// Every column the table shows can be sorted on.
export const SORT_FIELDS = [
  "id",
  "merchantName",
  "cardBrand",
  "amount",
  "surcharge",
  "total",
  "status",
  "createdAt",
] as const satisfies readonly (keyof Transaction)[]

export type SortField = (typeof SORT_FIELDS)[number]
export type SortOrder = "asc" | "desc"

export const DEFAULT_SORT: { sort: SortField; order: SortOrder } = { sort: "createdAt", order: "desc" }

export const CARD_BRANDS = Object.values(CardBrand)
export const STATUSES = Object.values(TransactionStatus)

// Which rows a request covers. The list and the summary take the same filters, so
// the numbers in the summary always describe exactly the rows in the table.
export interface Filters {
  q: string
  /** Empty = any brand. Otherwise rows with one of these brands. */
  cardBrands: CardBrand[]
  /** Empty = any status. Otherwise rows with one of these statuses. */
  statuses: TransactionStatus[]
}

export const NO_FILTERS: Filters = { q: "", cardBrands: [], statuses: [] }

export interface ListQuery extends Filters {
  page: number
  pageSize: number
  sort: SortField
  order: SortOrder
}

export interface Page<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// Case-insensitive substring match over the fields the search box advertises.
export const matchesSearch = (t: Transaction, term: string): boolean => {
  if (!term) return true
  const needle = term.toLowerCase()
  return (
    t.merchantName.toLowerCase().includes(needle) ||
    t.id.toLowerCase().includes(needle) ||
    t.cardBrand.toLowerCase().includes(needle) ||
    t.status.toLowerCase().includes(needle)
  )
}

// Search AND card filter AND status filter; within a filter, any selected value matches.
export const matchesFilters = (t: Transaction, { q, cardBrands, statuses }: Filters): boolean =>
  (cardBrands.length === 0 || cardBrands.includes(t.cardBrand)) &&
  (statuses.length === 0 || statuses.includes(t.status)) &&
  matchesSearch(t, q)

const isUnfiltered = ({ q, cardBrands, statuses }: Filters) => !q && cardBrands.length === 0 && statuses.length === 0

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true })

const compareValues = (a: string | number, b: string | number): number =>
  typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b))

// Sorts by one column, then by id in the same direction. The tiebreak matters: many
// rows share a value (every timestamp is midnight, amounts repeat, there are only four
// card brands), and without it a row could move between pages from one request to
// the next.
export const comparator = (sort: SortField, order: SortOrder) => {
  const sign = order === "asc" ? 1 : -1
  return (a: Transaction, b: Transaction): number =>
    sign * (compareValues(a[sort], b[sort]) || compareValues(a.id, b.id))
}

const compareDefault = comparator(DEFAULT_SORT.sort, DEFAULT_SORT.order)

export const createTransactionService = (seed: Transaction[] = loadTransactions()) => {
  // Kept sorted newest-first. create() prepends, which preserves the order because a
  // new transaction is always the newest.
  const transactions = [...seed].sort(compareDefault)

  const getAll = (): Transaction[] => transactions

  const list = ({ page, pageSize, sort, order, ...filters }: ListQuery): Page<Transaction> => {
    const filtered = isUnfiltered(filters) ? transactions : transactions.filter((t) => matchesFilters(t, filters))
    // The store is already in the default order; any other order sorts a copy of the
    // matching rows. That's O(n log n) per request, a few ms at 10k rows; at real scale
    // this is a database ORDER BY backed by an index (see question 2).
    const isDefaultSort = sort === DEFAULT_SORT.sort && order === DEFAULT_SORT.order
    const matching = isDefaultSort ? filtered : [...filtered].sort(comparator(sort, order))
    const start = (page - 1) * pageSize
    return {
      data: matching.slice(start, start + pageSize),
      page,
      pageSize,
      total: matching.length,
      totalPages: Math.ceil(matching.length / pageSize),
    }
  }

  const getById = (id: string): Transaction | undefined => transactions.find((t) => t.id === id)

  // "Processed" means money actually captured: APPROVED only (not declined, pending,
  // refunded or voided), using `total` so the surcharge the customer paid is included.
  const getSummary = (filters: Filters = NO_FILTERS): TransactionSummary => {
    let count = 0
    let processedCents = 0
    for (const t of transactions) {
      if (!matchesFilters(t, filters)) continue
      count++
      if (t.status === TransactionStatus.APPROVED) {
        processedCents += toCents(t.total)
      }
    }
    return { count, processedTotal: fromCents(processedCents) }
  }

  const create = (input: NewTransactionInput): Transaction => {
    const transaction: Transaction = {
      id: `txn_${String(transactions.length + 1).padStart(6, "0")}`,
      merchantName: input.merchantName,
      cardBrand: input.cardBrand,
      amount: input.amount,
      surchargeRate: 0,
      surcharge: 0,
      total: input.amount,
      status: TransactionStatus.APPROVED,
      createdAt: new Date().toISOString(),
    }
    transactions.unshift(transaction)
    return transaction
  }

  return { getAll, list, getById, getSummary, create }
}

export type TransactionService = ReturnType<typeof createTransactionService>
