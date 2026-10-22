export const formatCurrency = (value: number): string => {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

// Timestamps are UTC instants. Formatting them in the viewer's local zone shifted every
// seeded date (all midnight UTC) to the previous day for anyone west of UTC, so
// 2026-06-29T00:00Z showed as 6/28/2026. Dates are shown in UTC, and labelled where
// the time is shown too.
export const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC" })
}

export const formatDateTime = (iso: string): string => {
  const formatted = new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  })
  return `${formatted} UTC`
}

/** 0.03 → "3%", 0.03125 → "3.125%", 0.033333 → "3.333%" (at most 3 decimals). */
export const formatRate = (rate: number): string => `${Number((rate * 100).toFixed(3))}%`
