import express from "express"
import type { NextFunction, Request, Response } from "express"
import cors from "cors"

import { API_PORT } from "./config.js"
import { MAX_KEY_LENGTH, createIdempotencyStore } from "./http/idempotency.js"
import { parseListQuery, parseSummaryQuery } from "./http/list-query.js"
import { parseNewTransaction } from "./http/new-transaction.js"
import { surchargeConfigResponse } from "./services/surcharge.js"
import { createTransactionService } from "./services/transaction-service.js"
import type { Transaction } from "./models/transaction.js"

const app = express()

app.use(cors({ origin: "*", credentials: true }))
app.use(express.json())

const transactionService = createTransactionService()
const idempotency = createIdempotencyStore<Transaction>()

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" })
})

app.get("/api/transactions", (req: Request, res: Response) => {
  console.log("GET /api/transactions", req.query)
  const parsed = parseListQuery(req.query)
  if (!parsed.ok) {
    return res.status(400).json({ error: "Invalid query", details: parsed.errors })
  }
  res.json(transactionService.list(parsed.query))
})

app.get("/api/transactions/summary", (req: Request, res: Response) => {
  const parsed = parseSummaryQuery(req.query)
  if (!parsed.ok) {
    return res.status(400).json({ error: "Invalid query", details: parsed.errors })
  }
  res.json(transactionService.getSummary(parsed.filters))
})

app.get("/api/surcharge-config", (_req: Request, res: Response) => {
  res.json(surchargeConfigResponse())
})

app.post("/api/transactions", (req: Request, res: Response) => {
  const parsed = parseNewTransaction(req.body)
  if (!parsed.ok) {
    return res.status(400).json({ error: "Invalid transaction", fieldErrors: parsed.fieldErrors })
  }

  // Optional, so existing clients keep working; the web app always sends one.
  const key = req.get("Idempotency-Key")
  if (key !== undefined && (key.length === 0 || key.length > MAX_KEY_LENGTH)) {
    return res.status(400).json({ error: `Idempotency-Key must be 1-${MAX_KEY_LENGTH} characters` })
  }
  // The validated input, not the raw body, so formatting differences ("12.3" vs
  // "12.30") count as the same request.
  const fingerprint = JSON.stringify(parsed.input)
  if (key !== undefined) {
    const prior = idempotency.check(key, fingerprint)
    if (prior.kind === "replay") {
      res.setHeader("Idempotent-Replayed", "true")
      return res.status(201).json(prior.result)
    }
    if (prior.kind === "conflict") {
      return res.status(422).json({ error: "This Idempotency-Key was already used for a different transaction" })
    }
  }

  const transaction = transactionService.create(parsed.input)
  if (key !== undefined) idempotency.save(key, fingerprint, transaction)
  res.status(201).json(transaction)
})

app.get("/api/transactions/:id", (req: Request, res: Response) => {
  const transaction = transactionService.getById(req.params.id)
  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" })
  }
  res.json(transaction)
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  // express.json() rejects malformed bodies with this type; that's the client's
  // mistake, so a 400, not a 500 with a stack trace.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON" })
  }
  console.error(err)
  res.status(500).json({ error: err.message, stack: err.stack })
})

app.listen(API_PORT, () => {
  console.log(`API listening on http://localhost:${API_PORT} (${transactionService.getAll().length} transactions)`)
})
