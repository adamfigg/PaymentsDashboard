import { describe, expect, it } from "vitest"

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_SEARCH_LENGTH, parseListQuery, parseSummaryQuery } from "./list-query.js"

describe("parseListQuery", () => {
  it("applies defaults when nothing is passed", () => {
    expect(parseListQuery({})).toEqual({ ok: true, query: { page: 1, pageSize: DEFAULT_PAGE_SIZE, q: "" } })
  })

  it("parses valid values and trims the search", () => {
    expect(parseListQuery({ page: "3", pageSize: "10", q: "  Blue Ridge " })).toEqual({
      ok: true,
      query: { page: 3, pageSize: 10, q: "Blue Ridge" },
    })
  })

  it("treats empty strings as not provided", () => {
    expect(parseListQuery({ page: "", pageSize: "", q: "" })).toEqual({
      ok: true,
      query: { page: 1, pageSize: DEFAULT_PAGE_SIZE, q: "" },
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

describe("parseSummaryQuery", () => {
  it("defaults to no search and trims it", () => {
    expect(parseSummaryQuery({})).toEqual({ ok: true, q: "" })
    expect(parseSummaryQuery({ q: "  blue " })).toEqual({ ok: true, q: "blue" })
  })

  it("ignores paging params", () => {
    expect(parseSummaryQuery({ q: "blue", page: "abc" })).toEqual({ ok: true, q: "blue" })
  })

  it("applies the same search rules as the list", () => {
    expect(parseSummaryQuery({ q: "x".repeat(MAX_SEARCH_LENGTH + 1) }).ok).toBe(false)
    expect(parseSummaryQuery({ q: ["a", "b"] })).toEqual({ ok: false, errors: ["q must be a single value"] })
  })
})
