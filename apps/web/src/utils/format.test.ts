import { describe, expect, it } from "vitest"

import { CardBrand, TransactionStatus } from "../models/transaction"
import type { Transaction } from "../models/transaction"
import { computeProcessedTotal, formatCurrency } from "./format"

const txn = (status: TransactionStatus, amount: number, surcharge: number): Transaction => ({
  id: "txn_test",
  merchantName: "Test Merchant",
  cardBrand: CardBrand.VISA,
  amount,
  surchargeRate: 0,
  surcharge,
  total: Math.round((amount + surcharge) * 100) / 100,
  status,
  createdAt: "2026-06-29T00:00:00.000Z",
})

describe("computeProcessedTotal", () => {
  it("counts only APPROVED transactions", () => {
    const transactions = [
      txn(TransactionStatus.APPROVED, 100, 0),
      txn(TransactionStatus.DECLINED, 200, 0),
      txn(TransactionStatus.PENDING, 300, 0),
      txn(TransactionStatus.REFUNDED, 400, 0),
    ]
    expect(computeProcessedTotal(transactions)).toBe(100)
  })

  it("includes the surcharge (sums total, not amount)", () => {
    expect(computeProcessedTotal([txn(TransactionStatus.APPROVED, 100, 3)])).toBe(103)
  })

  it("sums in cents so float drift can't lose a cent", () => {
    // As floats, 0.7 + 0.1 === 0.7999999999999999, which truncated to 2dp shows $0.79
    const transactions = [txn(TransactionStatus.APPROVED, 0.7, 0), txn(TransactionStatus.APPROVED, 0.1, 0)]
    expect(computeProcessedTotal(transactions)).toBe(0.8)
  })

  it("stays exact across many rows", () => {
    const transactions = Array.from({ length: 10_000 }, () => txn(TransactionStatus.APPROVED, 0.1, 0.01))
    expect(computeProcessedTotal(transactions)).toBe(1100)
  })

  it("returns 0 for an empty list", () => {
    expect(computeProcessedTotal([])).toBe(0)
  })
})

describe("formatCurrency", () => {
  it("rounds rather than truncates", () => {
    expect(formatCurrency(6299522.489999984)).toBe("$6,299,522.49")
  })
})
