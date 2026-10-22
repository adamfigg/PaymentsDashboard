// Remembers the result of each POST by its Idempotency-Key, so a retried request (a
// double-click, or a retry after a timeout whose first attempt actually succeeded)
// returns the original transaction instead of creating a second charge.
//
// In memory and bounded (oldest keys dropped first). In production this lives in
// shared storage with a TTL (e.g. 24h), so it works across instances and restarts.

export const MAX_KEY_LENGTH = 255

interface Entry<T> {
  fingerprint: string
  result: T
}

export type IdempotencyCheck<T> =
  | { kind: "new" }
  | { kind: "replay"; result: T }
  | { kind: "conflict" } // same key, different request body

export const createIdempotencyStore = <T>(capacity = 1000) => {
  const entries = new Map<string, Entry<T>>()

  const check = (key: string, fingerprint: string): IdempotencyCheck<T> => {
    const entry = entries.get(key)
    if (!entry) return { kind: "new" }
    return entry.fingerprint === fingerprint ? { kind: "replay", result: entry.result } : { kind: "conflict" }
  }

  const save = (key: string, fingerprint: string, result: T) => {
    entries.set(key, { fingerprint, result })
    // Map iterates in insertion order, so the first key is the oldest.
    if (entries.size > capacity) entries.delete(entries.keys().next().value as string)
  }

  return { check, save }
}
