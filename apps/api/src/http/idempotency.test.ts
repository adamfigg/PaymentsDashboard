import { describe, expect, it } from "vitest"

import { createIdempotencyStore } from "./idempotency.js"

describe("idempotency store", () => {
  it("treats an unseen key as new", () => {
    expect(createIdempotencyStore<string>().check("k1", "a")).toEqual({ kind: "new" })
  })

  it("replays the saved result for the same key and request", () => {
    const store = createIdempotencyStore<string>()
    store.save("k1", "a", "txn_1")
    expect(store.check("k1", "a")).toEqual({ kind: "replay", result: "txn_1" })
  })

  it("flags the same key with a different request as a conflict", () => {
    const store = createIdempotencyStore<string>()
    store.save("k1", "a", "txn_1")
    expect(store.check("k1", "b")).toEqual({ kind: "conflict" })
  })

  it("forgets the oldest key when full", () => {
    const store = createIdempotencyStore<string>(2)
    store.save("k1", "a", "1")
    store.save("k2", "a", "2")
    store.save("k3", "a", "3")
    expect(store.check("k1", "a")).toEqual({ kind: "new" })
    expect(store.check("k3", "a")).toMatchObject({ kind: "replay" })
  })
})
