import { describe, expect, it } from "vitest"

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_SEARCH_LENGTH, parseListQuery, parseSummaryQuery } from "./list-query.js"

describe("parseListQuery", () => {
  it("applies defaults when nothing is passed", () => {
    expect(parseListQuery({})).toEqual({ ok: true, query: { page: 1, pageSize: DEFAULT_PAGE_SIZE, q: "", sort: "createdAt", order: "desc", cardBrands: [], statuses: [] } })
  })

  it("parses valid values and trims the search", () => {
    expect(parseListQuery({ page: "3", pageSize: "10", q: "  Blue Ridge " })).toEqual({
      ok: true,
      query: { page: 3, pageSize: 10, q: "Blue Ridge", sort: "createdAt", order: "desc", cardBrands: [], statuses: [] },
    })
  })

  it("treats empty strings as not provided", () => {
    expect(parseListQuery({ page: "", pageSize: "", q: "" })).toEqual({
      ok: true,
      query: { page: 1, pageSize: DEFAULT_PAGE_SIZE, q: "", sort: "createdAt", order: "desc", cardBrands: [], statuses: [] },
    })
  })

  it("caps pageSize instead of rejecting it", () => {
    expect(parseListQuery({ pageSize: "5000" })).toMatchObject({ ok: true, query: { pageSize: MAX_PAGE_SIZE } })
  })

  it.each(["0", "-1", "1.5", "abc", "1e3", " 2"])("rejects page=%j", (page) => {
    expect(parseListQuery({ page })).toEqual({ ok: false, errors: ["page must be a positive integer"] })
  })

  it("rejects repeated params", () => {
    expect(parseListQuery({ page: ["1", "2"] })).toEqual({ ok: false, errors: ["page must be a single value"] })
  })

  it("rejects an over-long search", () => {
    const result = parseListQuery({ q: "x".repeat(MAX_SEARCH_LENGTH + 1) })
    expect(result.ok).toBe(false)
  })

  it("reports every problem at once", () => {
    const result = parseListQuery({ page: "0", pageSize: "abc" })
    expect(result).toEqual({
      ok: false,
      errors: ["page must be a positive integer", "pageSize must be a positive integer"],
    })
  })
})

describe("parseListQuery sorting", () => {
  it("accepts any table column and either direction", () => {
    expect(parseListQuery({ sort: "amount", order: "asc" })).toMatchObject({ ok: true, query: { sort: "amount", order: "asc" } })
  })

  it("defaults to newest first", () => {
    expect(parseListQuery({})).toMatchObject({ ok: true, query: { sort: "createdAt", order: "desc", cardBrands: [], statuses: [] } })
  })

  it.each(["password", "__proto__", "constructor", "AMOUNT"])("rejects sort=%j", (sort) => {
    expect(parseListQuery({ sort })).toMatchObject({ ok: false })
  })

  it("rejects an unknown order", () => {
    expect(parseListQuery({ order: "up" })).toEqual({ ok: false, errors: ["order must be asc or desc"] })
  })
})

describe("card and status filters", () => {
  it("parses comma-separated values, trimming and de-duplicating", () => {
    expect(parseListQuery({ cardBrand: "VISA, AMEX,VISA", status: "APPROVED,VOIDED" })).toMatchObject({
      ok: true,
      query: { cardBrands: ["VISA", "AMEX"], statuses: ["APPROVED", "VOIDED"] },
    })
  })

  it("treats an empty value as no filter", () => {
    expect(parseListQuery({ cardBrand: "", status: "," })).toMatchObject({ ok: true, query: { cardBrands: [], statuses: [] } })
  })

  it("rejects unknown values instead of ignoring them", () => {
    const result = parseListQuery({ cardBrand: "VISA,DINERS", status: "approved" })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.errors).toEqual([
      "cardBrand must be a comma-separated list of: VISA, MASTERCARD, AMEX, DISCOVER (got DINERS)",
      "status must be a comma-separated list of: APPROVED, DECLINED, REFUNDED, PENDING, VOIDED (got approved)",
    ])
  })

  it("the summary parses the same filters", () => {
    expect(parseSummaryQuery({ cardBrand: "AMEX", status: "APPROVED" })).toEqual({
      ok: true,
      filters: { q: "", cardBrands: ["AMEX"], statuses: ["APPROVED"] },
    })
  })
})

describe("parseSummaryQuery", () => {
  it("defaults to no search and trims it", () => {
    expect(parseSummaryQuery({})).toEqual({ ok: true, filters: { q: "", cardBrands: [], statuses: [] } })
    expect(parseSummaryQuery({ q: "  blue " })).toMatchObject({ ok: true, filters: { q: "blue" } })
  })

  it("ignores paging params", () => {
    expect(parseSummaryQuery({ q: "blue", page: "abc" })).toMatchObject({ ok: true, filters: { q: "blue" } })
  })

  it("applies the same search rules as the list", () => {
    expect(parseSummaryQuery({ q: "x".repeat(MAX_SEARCH_LENGTH + 1) }).ok).toBe(false)
    expect(parseSummaryQuery({ q: ["a", "b"] })).toEqual({ ok: false, errors: ["q must be a single value"] })
  })
})
