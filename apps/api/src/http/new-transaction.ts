import { TransactionStatus } from "../models/transaction.js"
import type { CardBrand } from "../models/transaction.js"
import { SURCHARGE_CONFIG } from "../services/surcharge.js"
import { CARD_BRANDS, STATUSES } from "../services/transaction-service.js"
import type { NewTransactionInput } from "../services/transaction-service.js"
import { PERCENT_SCALE, parseDollars, parsePercent, percentOfCents } from "../utils/money.js"

export const MAX_MERCHANT_LENGTH = 100
export const MAX_AMOUNT_CENTS = 100_000_000 // $1,000,000.00

export type FieldErrors = Partial<Record<"merchantName" | "cardBrand" | "status" | "amount" | "surcharge", string>>

export type NewTransactionResult = { ok: true; input: NewTransactionInput } | { ok: false; fieldErrors: FieldErrors }

const formatPercent = (milli: number) => `${milli / PERCENT_SCALE}%`

/**
 * Validates a POST /api/transactions body and resolves the money.
 *
 * Money arrives as decimal strings ("12.34", "3.125"), never JSON numbers, so the value
 * is exactly what the user typed. The surcharge can be given either as a percent
 * (`surchargePercent`) or as a dollar amount (`surcharge`), whichever the user entered,
 * and the server derives the other. With neither, the default rate applies. The total
 * is always computed here; it's never accepted from the client.
 */
export const parseNewTransaction = (body: unknown): NewTransactionResult => {
  const b: Record<string, unknown> = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const fieldErrors: FieldErrors = {}

  const merchantName = typeof b.merchantName === "string" ? b.merchantName.trim() : ""
  if (!merchantName) fieldErrors.merchantName = "Enter a merchant name"
  else if (merchantName.length > MAX_MERCHANT_LENGTH)
    fieldErrors.merchantName = `Merchant name must be ${MAX_MERCHANT_LENGTH} characters or fewer`

  const cardBrand = b.cardBrand as CardBrand
  if (!CARD_BRANDS.includes(cardBrand)) fieldErrors.cardBrand = `Choose a card brand (${CARD_BRANDS.join(", ")})`

  // New transactions start PENDING unless the user picks otherwise.
  const status = (b.status ?? TransactionStatus.PENDING) as TransactionStatus
  if (!STATUSES.includes(status)) fieldErrors.status = `Choose a status (${STATUSES.join(", ")})`

  let amountCents: number | null = null
  if (typeof b.amount !== "string") {
    fieldErrors.amount = 'Amount must be a decimal string, e.g. "12.34"'
  } else {
    amountCents = parseDollars(b.amount)
    if (amountCents === null) fieldErrors.amount = "Enter an amount like 12.34 (at most 2 decimal places)"
    else if (amountCents === 0) fieldErrors.amount = "Amount must be more than $0.00"
    else if (amountCents > MAX_AMOUNT_CENTS) fieldErrors.amount = "Amount can't be more than $1,000,000.00"
  }

  const hasPercent = b.surchargePercent !== undefined
  const hasAmount = b.surcharge !== undefined
  let milliPercent: number | null = null
  let surchargeCents: number | null = null
  if (hasPercent && hasAmount) {
    fieldErrors.surcharge = "Send either surcharge or surchargePercent, not both"
  } else if (hasAmount) {
    surchargeCents = typeof b.surcharge === "string" ? parseDollars(b.surcharge) : null
    if (surchargeCents === null) fieldErrors.surcharge = "Enter a surcharge like 0.39 (at most 2 decimal places)"
  } else {
    milliPercent = hasPercent
      ? typeof b.surchargePercent === "string"
        ? parsePercent(b.surchargePercent)
        : null
      : SURCHARGE_CONFIG.defaultMilliPercent
    if (milliPercent === null) fieldErrors.surcharge = "Enter a surcharge rate like 3 or 3.5 (at most 3 decimal places)"
  }

  const tooHigh = `Surcharge can't be more than ${formatPercent(SURCHARGE_CONFIG.maxMilliPercent)} of the amount`
  if (milliPercent !== null && milliPercent > SURCHARGE_CONFIG.maxMilliPercent) {
    // Check a typed percent as typed: checking the rounded cents instead would reject
    // exactly 10% on $12.99, because $1.299 rounds up to $1.30.
    fieldErrors.surcharge = tooHigh
  }

  // The dollar checks need a valid amount; if the amount is already wrong, that error is enough.
  if (amountCents !== null && amountCents > 0 && !fieldErrors.amount && !fieldErrors.surcharge) {
    if (milliPercent !== null) {
      surchargeCents = percentOfCents(amountCents, milliPercent)
    } else if (surchargeCents !== null && surchargeCents * 100_000 > amountCents * SURCHARGE_CONFIG.maxMilliPercent) {
      // A typed dollar surcharge: compare surcharge / amount with the max as integers
      // (s × 100,000 ≤ a × max) so there's no float division.
      fieldErrors.surcharge = tooHigh
    }
  }

  if (Object.keys(fieldErrors).length > 0 || amountCents === null || surchargeCents === null) {
    return { ok: false, fieldErrors }
  }

  // The rate actually charged. When the user typed a dollar surcharge it's derived,
  // e.g. $1.00 on $30.00 = 0.033333 (3.3333%); 6 decimal places is display precision only.
  const surchargeRate =
    milliPercent !== null ? milliPercent / (100 * PERCENT_SCALE) : Number((surchargeCents / amountCents).toFixed(6))

  return {
    ok: true,
    input: { merchantName, cardBrand, status, amountCents, surchargeCents, surchargeRate },
  }
}
