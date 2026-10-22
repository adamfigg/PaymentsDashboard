import { TransactionStatus } from "../models/transaction"
import type { Transaction } from "../models/transaction"

export const formatCurrency = (value: number): string => {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleDateString("en-US")
}

// Dollar amounts arrive as floats (e.g. 12.34). Summing floats drifts (0.7 + 0.1 =
// 0.7999999999999999), so money is accumulated as integer cents and only converted
// back to dollars once, at the end.
const toCents = (dollars: number): number => Math.round(dollars * 100)

// "Processed" means money actually captured: APPROVED transactions only (not declined,
// pending, refunded or voided), using `total` so the surcharge the customer paid is
// included.
export const computeProcessedTotal = (transactions: Transaction[]): number => {
  let cents = 0
  for (const t of transactions) {
    if (t.status === TransactionStatus.APPROVED) {
      cents += toCents(t.total)
    }
  }
  return cents / 100
}
