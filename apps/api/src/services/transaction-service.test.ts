import { describe, expect, it } from "vitest"

import { CardBrand, TransactionStatus } from "../models/transaction.js"
import type { Transaction } from "../models/transaction.js"
import { createTransactionService } from "./transaction-service.js"

const txn = (n: number, overrides: Partial<Transaction> = {}): Transaction => ({
  id: `txn_${String(n).padStart(6, "0")}`,
  merchantName: "Test Merchant",
  cardBrand: CardBrand.VISA,
  amount: 10,
  surchargeRate: 0,
  surcharge: 0,
  total: 10,
  status: TransactionStatus.APPROVED,
  createdAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
})

const ids = (rows: Transaction[]) => rows.map((t) => t.id)

describe("transactionService.list", () => {
  // 7 rows, deliberately out of order, several sharing a timestamp
  const seed = [
    txn(1, { createdAt: "2026-06-01T00:00:00.000Z" }),
    txn(5, { createdAt: "2026-06-03T00:00:00.000Z" }),
    txn(2, { createdAt: "2026-06-01T00:00:00.000Z" }),
    txn(7, { createdAt: "2026-06-03T00:00:00.000Z", merchantName: "Blue Ridge Outfitters" }),
    txn(3, { createdAt: "2026-06-02T00:00:00.000Z", cardBrand: CardBrand.AMEX }),
    txn(6, { createdAt: "2026-06-03T00:00:00.000Z", status: TransactionStatus.DECLINED }),
    txn(4, { createdAt: "2026-06-02T00:00:00.000Z", merchantName: "Blue Bottle Cafe" }),
  ]
  const service = createTransactionService(seed)

  it("sorts newest first, breaking createdAt ties by id", () => {
    const { data } = service.list({ page: 1, pageSize: 10, q: "" })
    expect(ids(data)).toEqual(["txn_000007", "txn_000006", "txn_000005", "txn_000004", "txn_000003", "txn_000002", "txn_000001"])
  })

  it("returns one page plus totals", () => {
    expect(service.list({ page: 1, pageSize: 3, q: "" })).toMatchObject({
      page: 1,
      pageSize: 3,
      total: 7,
      totalPages: 3,
    })
  })

  it("pages are disjoint and together cover every row exactly once", () => {
    const pages = [1, 2, 3].map((page) => ids(service.list({ page, pageSize: 3, q: "" }).data))
    expect(pages.map((p) => p.length)).toEqual([3, 3, 1])
    expect(new Set(pages.flat()).size).toBe(7)
  })

  it("returns an empty page past the end, with the real total", () => {
    expect(service.list({ page: 99, pageSize: 3, q: "" })).toMatchObject({ data: [], total: 7, totalPages: 3 })
  })

  it.each([
    ["merchant", "blue", ["txn_000007", "txn_000004"]],
    ["case-insensitive", "BLUE RIDGE", ["txn_000007"]],
    ["id", "000003", ["txn_000003"]],
    ["card brand", "amex", ["txn_000003"]],
    ["status", "declined", ["txn_000006"]],
  ])("searches by %s", (_label, q, expected) => {
    expect(ids(service.list({ page: 1, pageSize: 10, q }).data)).toEqual(expected)
  })

  it("searches the full dataset before paginating", () => {
    const result = service.list({ page: 2, pageSize: 1, q: "blue" })
    expect(ids(result.data)).toEqual(["txn_000004"])
    expect(result).toMatchObject({ total: 2, totalPages: 2 })
  })

  it("returns no rows and zero pages when nothing matches", () => {
    expect(service.list({ page: 1, pageSize: 10, q: "zzz" })).toMatchObject({ data: [], total: 0, totalPages: 0 })
  })

  it("does not mutate the seed array", () => {
    expect(ids(seed)[0]).toBe("txn_000001")
  })
})

describe("transactionService.create", () => {
  it("puts the new transaction on the first page", () => {
    const service = createTransactionService([txn(1), txn(2)])
    const created = service.create({ merchantName: "New Co", cardBrand: CardBrand.VISA, amount: 5 })
    expect(service.list({ page: 1, pageSize: 1, q: "" }).data[0].id).toBe(created.id)
  })
})

describe("transactionService.getSummary", () => {
  const approved = (n: number, total: number, overrides: Partial<Transaction> = {}) =>
    txn(n, { amount: total, total, status: TransactionStatus.APPROVED, ...overrides })

  it("totals only APPROVED transactions but counts every matching row", () => {
    const service = createTransactionService([
      approved(1, 100),
      txn(2, { total: 200, status: TransactionStatus.DECLINED }),
      txn(3, { total: 300, status: TransactionStatus.PENDING }),
      txn(4, { total: 400, status: TransactionStatus.REFUNDED }),
    ])
    expect(service.getSummary()).toEqual({ count: 4, processedTotal: 100 })
  })

  it("includes the surcharge (sums total, not amount)", () => {
    const service = createTransactionService([approved(1, 103, { amount: 100, surcharge: 3 })])
    expect(service.getSummary().processedTotal).toBe(103)
  })

  it("sums in cents so float drift can't lose a cent", () => {
    // As floats, 0.7 + 0.1 === 0.7999999999999999
    const service = createTransactionService([approved(1, 0.7), approved(2, 0.1)])
    expect(service.getSummary().processedTotal).toBe(0.8)
  })

  it("stays exact across many rows", () => {
    const service = createTransactionService(Array.from({ length: 10_000 }, (_, i) => approved(i + 1, 0.11)))
    expect(service.getSummary().processedTotal).toBe(1100)
  })

  it("applies the same search as list(), so the numbers match what's shown", () => {
    const service = createTransactionService([
      approved(1, 10, { merchantName: "Blue Ridge Outfitters" }),
      approved(2, 20, { merchantName: "Blue Bottle Cafe" }),
      txn(3, { total: 30, merchantName: "Blue Moon Diner", status: TransactionStatus.DECLINED }),
      approved(4, 40, { merchantName: "Red Rock Coffee" }),
    ])
    const summary = service.getSummary("blue")
    expect(summary).toEqual({ count: 3, processedTotal: 30 })
    expect(summary.count).toBe(service.list({ page: 1, pageSize: 1, q: "blue" }).total)
  })

  it("returns zeros when nothing matches", () => {
    expect(createTransactionService([approved(1, 10)]).getSummary("zzz")).toEqual({ count: 0, processedTotal: 0 })
  })
})
