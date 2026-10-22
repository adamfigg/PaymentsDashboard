import { afterEach, describe, expect, it } from "vitest"

import { requireSecret } from "./config.js"

describe("requireSecret", () => {
  const original = process.env.PROCESSOR_WEBHOOK_SECRET

  afterEach(() => {
    if (original === undefined) delete process.env.PROCESSOR_WEBHOOK_SECRET
    else process.env.PROCESSOR_WEBHOOK_SECRET = original
  })

  it("returns the value from the environment", () => {
    process.env.PROCESSOR_WEBHOOK_SECRET = "whsec_test"
    expect(requireSecret("PROCESSOR_WEBHOOK_SECRET")).toBe("whsec_test")
  })

  it.each([undefined, ""])("fails loudly when the secret is %j, rather than sending an empty value", (value) => {
    if (value === undefined) delete process.env.PROCESSOR_WEBHOOK_SECRET
    else process.env.PROCESSOR_WEBHOOK_SECRET = value
    expect(() => requireSecret("PROCESSOR_WEBHOOK_SECRET")).toThrow(
      "Missing required secret PROCESSOR_WEBHOOK_SECRET. Set it in apps/api/.env (see .env.example).",
    )
  })
})
