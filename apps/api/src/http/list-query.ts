import { CARD_BRANDS, DEFAULT_SORT, SORT_FIELDS, STATUSES } from "../services/transaction-service.js"
import type { Filters, ListQuery, SortField, SortOrder } from "../services/transaction-service.js"

export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100
export const MAX_SEARCH_LENGTH = 100

export type ParseResult = { ok: true; query: ListQuery } | { ok: false; errors: string[] }

// Express gives query values as string | string[] | ParsedQs | undefined.
// Anything other than a single string (e.g. ?page=1&page=2) is rejected.
const single = (value: unknown, name: string, errors: string[]): string | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== "string") {
    errors.push(`${name} must be a single value`)
    return undefined
  }
  return value
}

const positiveInt = (raw: string | undefined, name: string, fallback: number, errors: string[]): number => {
  if (raw === undefined || raw === "") return fallback
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    errors.push(`${name} must be a positive integer`)
    return fallback
  }
  return Number(raw)
}

const searchTerm = (query: Record<string, unknown>, errors: string[]): string => {
  const q = (single(query.q, "q", errors) ?? "").trim()
  if (q.length > MAX_SEARCH_LENGTH) {
    errors.push(`q must be at most ${MAX_SEARCH_LENGTH} characters`)
  }
  return q
}

// Comma-separated values from a fixed set, e.g. ?status=APPROVED,PENDING.
// Unknown values are a 400 rather than silently ignored: a typo would otherwise look
// like a filter that matches nothing. Duplicates are dropped.
const enumList = <T extends string>(raw: string | undefined, name: string, allowed: readonly T[], errors: string[]): T[] => {
  if (!raw) return []
  const values = [...new Set(raw.split(",").map((v) => v.trim()).filter(Boolean))]
  const unknown = values.filter((v) => !(allowed as readonly string[]).includes(v))
  if (unknown.length > 0) {
    errors.push(`${name} must be a comma-separated list of: ${allowed.join(", ")} (got ${unknown.join(", ")})`)
    return []
  }
  return values as T[]
}

const parseFilters = (query: Record<string, unknown>, errors: string[]): Filters => ({
  q: searchTerm(query, errors),
  cardBrands: enumList(single(query.cardBrand, "cardBrand", errors), "cardBrand", CARD_BRANDS, errors),
  statuses: enumList(single(query.status, "status", errors), "status", STATUSES, errors),
})

// The summary takes the same filters as the list (but no paging or sort), parsed by
// the same rules, so a filter can't mean different things on the two endpoints.
export const parseSummaryQuery = (
  query: Record<string, unknown>,
): { ok: true; filters: Filters } | { ok: false; errors: string[] } => {
  const errors: string[] = []
  const filters = parseFilters(query, errors)
  return errors.length > 0 ? { ok: false, errors } : { ok: true, filters }
}

export const parseListQuery = (query: Record<string, unknown>): ParseResult => {
  const errors: string[] = []

  const page = positiveInt(single(query.page, "page", errors), "page", 1, errors)
  // Over-large page sizes are capped rather than rejected; the response echoes the
  // pageSize actually used so the client can tell.
  const pageSize = Math.min(
    positiveInt(single(query.pageSize, "pageSize", errors), "pageSize", DEFAULT_PAGE_SIZE, errors),
    MAX_PAGE_SIZE,
  )

  const filters = parseFilters(query, errors)

  // `sort` becomes a property key on the server, so it's checked against a whitelist
  // first: ?sort=__proto__ or an unknown column is a 400, not an odd sort.
  const sortRaw = single(query.sort, "sort", errors)
  let sort: SortField = DEFAULT_SORT.sort
  if (sortRaw) {
    if ((SORT_FIELDS as readonly string[]).includes(sortRaw)) sort = sortRaw as SortField
    else errors.push(`sort must be one of: ${SORT_FIELDS.join(", ")}`)
  }

  const orderRaw = single(query.order, "order", errors)
  let order: SortOrder = DEFAULT_SORT.order
  if (orderRaw) {
    if (orderRaw === "asc" || orderRaw === "desc") order = orderRaw
    else errors.push("order must be asc or desc")
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, query: { page, pageSize, sort, order, ...filters } }
}
