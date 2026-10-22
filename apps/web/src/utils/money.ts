// Integer money helpers for the form. They mirror apps/api/src/utils/money.ts so the
// live preview matches what the server will compute. The server's figures are final;
// with a shared package this would be one module (see "with more time").

export const PERCENT_SCALE = 1000

// What a person might reasonably type: "$1,234.50" → "1234.50".
export const normalizeAmountInput = (raw: string): string => raw.trim().replace(/^\$/, "").replace(/,/g, "")

/** "12.34" → 1234 cents. Null unless a plain non-negative amount with at most 2 decimals. */
export const parseDollars = (raw: string): number | null => {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(normalizeAmountInput(raw))
  if (!m) return null
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"))
}

/** "3.125" → 3125 thousandths of a percent. Null unless at most 3 decimals. */
export const parsePercent = (raw: string): number | null => {
  const m = /^(\d{1,3})(?:\.(\d{1,3}))?$/.exec(raw.trim().replace(/%$/, ""))
  if (!m) return null
  return Number(m[1]) * PERCENT_SCALE + Number((m[2] ?? "").padEnd(3, "0"))
}

/** amount × percent, half-up to the cent, integer arithmetic only. */
export const percentOfCents = (amountCents: number, milliPercent: number): number =>
  Math.floor((amountCents * milliPercent + 50_000) / 100_000)

/** The percent `part` is of `whole`, in thousandths, half-up. 100 on 3000 → 3333 (3.333%). */
export const milliPercentOf = (partCents: number, wholeCents: number): number =>
  wholeCents === 0 ? 0 : Math.floor((partCents * 100_000 * 2 + wholeCents) / (wholeCents * 2))

/** 1234 → "12.34" (for inputs and the API). */
export const centsToInput = (cents: number): string => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`

/** 3125 → "3.125", 3000 → "3" (for inputs and the API). */
export const milliPercentToInput = (milli: number): string => String(milli / PERCENT_SCALE)

/** 1234 → "$12.34" for display. */
export const formatCents = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
