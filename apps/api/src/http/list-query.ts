import type { ListQuery } from "../services/transaction-service.js"

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

// The summary takes the same search as the list (but no paging), parsed by the same
// rules, so `?q=` can't mean different things on the two endpoints.
export const parseSummaryQuery = (
  query: Record<string, unknown>,
): { ok: true; q: string } | { ok: false; errors: string[] } => {
  const errors: string[] = []
  const q = searchTerm(query, errors)
  return errors.length > 0 ? { ok: false, errors } : { ok: true, q }
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

  const q = searchTerm(query, errors)

  return errors.length > 0 ? { ok: false, errors } : { ok: true, query: { page, pageSize, q } }
}
