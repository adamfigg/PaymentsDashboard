// Dollar amounts are stored as floats (e.g. 12.34). Summing floats drifts (0.7 + 0.1 =
// 0.7999999999999999), so sums are accumulated as integer cents and converted back to
// dollars once, at the end.
export const toCents = (dollars: number): number => Math.round(dollars * 100)

export const fromCents = (cents: number): number => cents / 100

// Money coming *in* is a decimal string ("12.34"), parsed digit by digit, so it never
// passes through a float. Percentages are held as thousandths of a percent:
// "3" → 3000, "3.125" → 3125, which covers any rate a card program would quote.
export const PERCENT_SCALE = 1000

/** "12.34" → 1234. Null unless it's a plain non-negative amount with at most 2 decimals. */
export const parseDollars = (raw: string): number | null => {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(raw.trim())
  if (!m) return null
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"))
}

/** "3.125" → 3125 (thousandths of a percent). Null unless at most 3 decimals. */
export const parsePercent = (raw: string): number | null => {
  const m = /^(\d{1,3})(?:\.(\d{1,3}))?$/.exec(raw.trim())
  if (!m) return null
  return Number(m[1]) * PERCENT_SCALE + Number((m[2] ?? "").padEnd(3, "0"))
}

/**
 * amount × percent, rounded half-up to the cent, in integer arithmetic only.
 * amountCents × milliPercent / 100,000, plus half the divisor before flooring.
 * (The seed data did this in floats and is a cent low in 10 rows, e.g.
 * $1,108.50 × 3% = $33.255, which should be $33.26, not $33.25.)
 */
export const percentOfCents = (amountCents: number, milliPercent: number): number =>
  Math.floor((amountCents * milliPercent + 50_000) / 100_000)
