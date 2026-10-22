import { describe, expect, it } from "vitest"

import { formatCurrency, formatDate, formatDateTime, formatRate } from "./format"

// The processed-total tests moved to the API with the logic
// (apps/api/src/services/transaction-service.test.ts).
describe("formatCurrency", () => {
  it("rounds rather than truncates", () => {
    expect(formatCurrency(6299522.489999984)).toBe("$6,299,522.49")
  })
})

describe("formatDate", () => {
  it("shows the UTC date, not the previous day west of UTC", () => {
    expect(formatDate("2026-06-29T00:00:00.000Z")).toBe("6/29/2026")
    expect(formatDate("2026-06-29T23:59:59.000Z")).toBe("6/29/2026")
  })
})

describe("formatDateTime", () => {
  it("includes the time and says it's UTC", () => {
    expect(formatDateTime("2026-10-22T19:29:03.082Z")).toBe("Oct 22, 2026, 7:29 PM UTC")
  })
})

describe("formatRate", () => {
  it.each([
    [0.03, "3%"],
    [0.035, "3.5%"],
    [0.03125, "3.125%"],
    [0.033333, "3.333%"],
    [0, "0%"],
  ])("%d → %s", (rate, expected) => {
    expect(formatRate(rate)).toBe(expected)
  })
})
