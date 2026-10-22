import { describe, expect, it } from "vitest"

import { centsToInput, milliPercentOf, milliPercentToInput, parseDollars, parsePercent, percentOfCents } from "./money"

describe("parseDollars", () => {
  it.each([
    ["12.99", 1299],
    ["$1,234.5", 123450],
    [" 7 ", 700],
  ])("%j → %i", (raw, cents) => {
    expect(parseDollars(raw)).toBe(cents)
  })

  it.each(["12.999", "-5", "abc", "", "1e3"])("rejects %j", (raw) => {
    expect(parseDollars(raw)).toBeNull()
  })
})

describe("parsePercent", () => {
  it("accepts a trailing % and up to 3 decimals", () => {
    expect(parsePercent("3.125%")).toBe(3125)
    expect(parsePercent("3.1234")).toBeNull()
  })
})

describe("surcharge conversions", () => {
  it("matches the server's half-up rounding", () => {
    expect(percentOfCents(110850, 3000)).toBe(3326)
    expect(percentOfCents(1299, 3000)).toBe(39)
  })

  it("derives a percent from a dollar surcharge", () => {
    expect(milliPercentOf(100, 3000)).toBe(3333) // $1 on $30 = 3.333%
    expect(milliPercentOf(39, 1299)).toBe(3002) // $0.39 on $12.99 = 3.002%
    expect(milliPercentOf(5, 0)).toBe(0)
  })

  it("formats back to input strings", () => {
    expect(centsToInput(1299)).toBe("12.99")
    expect(centsToInput(5)).toBe("0.05")
    expect(milliPercentToInput(3000)).toBe("3")
    expect(milliPercentToInput(3125)).toBe("3.125")
  })
})
