import { describe, expect, it } from "vitest"

import { parseNewTransaction } from "./new-transaction.js"

const valid = { merchantName: "Blue Ridge Outfitters", cardBrand: "VISA", amount: "12.99" }

describe("parseNewTransaction", () => {
  it("defaults to a 3% surcharge and PENDING", () => {
    expect(parseNewTransaction(valid)).toEqual({
      ok: true,
      input: {
        merchantName: "Blue Ridge Outfitters",
        cardBrand: "VISA",
        status: "PENDING",
        amountCents: 1299,
        surchargeCents: 39,
        surchargeRate: 0.03,
      },
    })
  })

  it("keeps the cents that parseInt used to drop", () => {
    expect(parseNewTransaction({ ...valid, amount: "1108.50" })).toMatchObject({
      ok: true,
      input: { amountCents: 110850, surchargeCents: 3326 },
    })
  })

  it("applies a custom percent", () => {
    expect(parseNewTransaction({ ...valid, amount: "100", surchargePercent: "3.125" })).toMatchObject({
      ok: true,
      input: { surchargeCents: 313, surchargeRate: 0.03125 },
    })
  })

  it("accepts a dollar surcharge and derives the rate", () => {
    expect(parseNewTransaction({ ...valid, amount: "30.00", surcharge: "1.00" })).toMatchObject({
      ok: true,
      input: { surchargeCents: 100, surchargeRate: 0.033333 },
    })
  })

  it("allows a zero surcharge", () => {
    expect(parseNewTransaction({ ...valid, surchargePercent: "0" })).toMatchObject({ ok: true, input: { surchargeCents: 0 } })
  })

  it("accepts any status the user picks", () => {
    expect(parseNewTransaction({ ...valid, status: "APPROVED" })).toMatchObject({ ok: true, input: { status: "APPROVED" } })
  })

  it("trims the merchant name", () => {
    expect(parseNewTransaction({ ...valid, merchantName: "  Acme  " })).toMatchObject({ ok: true, input: { merchantName: "Acme" } })
  })

  it("reports every invalid field at once", () => {
    expect(parseNewTransaction({ merchantName: " ", cardBrand: "DINERS", status: "DONE", amount: "abc" })).toEqual({
      ok: false,
      fieldErrors: {
        merchantName: "Enter a merchant name",
        cardBrand: "Choose a card brand (VISA, MASTERCARD, AMEX, DISCOVER)",
        status: "Choose a status (APPROVED, DECLINED, REFUNDED, PENDING, VOIDED)",
        amount: "Enter an amount like 12.34 (at most 2 decimal places)",
      },
    })
  })

  it.each([
    [{ amount: 12.99 }, "amount", 'Amount must be a decimal string, e.g. "12.34"'],
    [{ amount: "0" }, "amount", "Amount must be more than $0.00"],
    [{ amount: "12.999" }, "amount", "Enter an amount like 12.34 (at most 2 decimal places)"],
    [{ amount: "1000000.01" }, "amount", "Amount can't be more than $1,000,000.00"],
    [{ merchantName: "x".repeat(101) }, "merchantName", "Merchant name must be 100 characters or fewer"],
    [{ surchargePercent: "10.001" }, "surcharge", "Surcharge can't be more than 10% of the amount"],
    [{ amount: "10.00", surcharge: "1.01" }, "surcharge", "Surcharge can't be more than 10% of the amount"],
    [{ surchargePercent: "3", surcharge: "0.39" }, "surcharge", "Send either surcharge or surchargePercent, not both"],
    [{ surchargePercent: 3 }, "surcharge", "Enter a surcharge rate like 3 or 3.5 (at most 3 decimal places)"],
  ])("rejects %j", (override, field, message) => {
    expect(parseNewTransaction({ ...valid, ...override })).toEqual({ ok: false, fieldErrors: { [field]: message } })
  })

  it("allows exactly the maximum rate", () => {
    expect(parseNewTransaction({ ...valid, amount: "10.00", surcharge: "1.00" }).ok).toBe(true)
    expect(parseNewTransaction({ ...valid, surchargePercent: "10" }).ok).toBe(true)
  })

  it("rejects a body that isn't an object", () => {
    expect(parseNewTransaction(null)).toMatchObject({ ok: false })
    expect(parseNewTransaction("hello")).toMatchObject({ ok: false })
  })
})
