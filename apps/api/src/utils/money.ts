// Dollar amounts are stored as floats (e.g. 12.34). Summing floats drifts (0.7 + 0.1 =
// 0.7999999999999999), so sums are accumulated as integer cents and converted back to
// dollars once, at the end.
export const toCents = (dollars: number): number => Math.round(dollars * 100)

export const fromCents = (cents: number): number => cents / 100
