import { describe, expect, it } from "vitest"

import { formatCurrency } from "./format"

// The processed-total tests moved to the API with the logic
// (apps/api/src/services/transaction-service.test.ts).
describe("formatCurrency", () => {
  it("rounds rather than truncates", () => {
    expect(formatCurrency(6299522.489999984)).toBe("$6,299,522.49")
  })
})
