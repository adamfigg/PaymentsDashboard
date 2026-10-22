import { describe, expect, it } from "vitest"

import { parseDollars, parsePercent, percentOfCents } from "./money.js"

describe("parseDollars", () => {
  it.each([
    ["12.34", 1234],
    ["12.3", 1230],
    ["12", 1200],
    ["0.01", 1],
    [" 7.50 ", 750],
    ["0", 0],
    ["999999999.99", 99999999999],
  ])("%j → %i cents", (raw, cents) => {
    expect(parseDollars(raw)).toBe(cents)
  })

  it.each(["", "12.345", "-1", "1e3", "12,34", "1,234.00", "$12", ".5", "12.", "abc", "1234567890"])("rejects %j", (raw) => {
    expect(parseDollars(raw)).toBeNull()
  })
})

describe("parsePercent", () => {
  it.each([
    ["3", 3000],
    ["3.5", 3500],
    ["3.125", 3125],
    ["0", 0],
    ["10", 10000],
  ])("%j%% → %i thousandths", (raw, milli) => {
    expect(parsePercent(raw)).toBe(milli)
  })

  it.each(["3.1234", "-3", "3%", "", "1000"])("rejects %j", (raw) => {
    expect(parsePercent(raw)).toBeNull()
  })
})

describe("percentOfCents", () => {
  it("rounds an exact half cent up (where the seed data's float maths rounded down)", () => {
    // $1,108.50 × 3% = $33.255 exactly. As floats: 1108.5 * 0.03 = 33.254999999999995
    expect(percentOfCents(110850, 3000)).toBe(3326)
    expect(percentOfCents(219250, 3000)).toBe(6578) // $65.775 → $65.78
  })

  it("rounds below half down", () => {
    expect(percentOfCents(1299, 3000)).toBe(39) // $0.3897 → $0.39
    expect(percentOfCents(1001, 3000)).toBe(30) // $0.3003 → $0.30
  })

  it("handles fractional percents and zero", () => {
    expect(percentOfCents(10000, 3125)).toBe(313) // $100 × 3.125% = $3.125 → $3.13
    expect(percentOfCents(10000, 0)).toBe(0)
  })

  it("stays exact at the largest allowed amount and rate", () => {
    // $1,000,000.00 × 10%: 1e8 × 1e4 = 1e12, well inside safe integer range
    expect(percentOfCents(100_000_000, 10_000)).toBe(10_000_000)
  })
})
