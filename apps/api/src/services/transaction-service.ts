import { TransactionStatus } from "../models/transaction.js"
import type { CardBrand, Transaction } from "../models/transaction.js"
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

export interface ListQuery {
  page: number
  pageSize: number
  q: string
}

export interface Page<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// Case-insensitive substring match over the fields the search box advertises. Shared
// by list and summary so the two always agree on which rows a search covers.
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

// Newest first. Every timestamp in the data is midnight, so many rows tie on
// createdAt; id breaks the tie so a row can't move between pages from one request
// to the next.
export const compareNewestFirst = (a: Transaction, b: Transaction): number => {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
  if (a.id !== b.id) return a.id < b.id ? 1 : -1
  return 0
}

export const createTransactionService = (seed: Transaction[] = loadTransactions()) => {
  // Kept sorted newest-first. create() prepends, which preserves the order because a
  // new transaction is always the newest.
  const transactions = [...seed].sort(compareNewestFirst)

  const getAll = (): Transaction[] => transactions

  const list = ({ page, pageSize, q }: ListQuery): Page<Transaction> => {
    const matching = q ? transactions.filter((t) => matchesSearch(t, q)) : transactions
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
  const getSummary = (q = ""): TransactionSummary => {
    let count = 0
    let processedCents = 0
    for (const t of transactions) {
      if (!matchesSearch(t, q)) continue
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
