import express from "express"
import type { NextFunction, Request, Response } from "express"
import cors from "cors"

import { API_PORT } from "./config.js"
import { parseListQuery, parseSummaryQuery } from "./http/list-query.js"
import { createTransactionService } from "./services/transaction-service.js"

const app = express()

app.use(cors({ origin: "*", credentials: true }))
app.use(express.json())

const transactionService = createTransactionService()

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
  res.json(transactionService.getSummary(parsed.q))
})

app.post("/api/transactions", (req: Request, res: Response) => {
  const { merchantName, cardBrand, amount } = req.body
  const transaction = transactionService.create({ merchantName, cardBrand, amount })
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
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: err.message, stack: err.stack })
})

app.listen(API_PORT, () => {
  console.log(`API listening on http://localhost:${API_PORT} (${transactionService.getAll().length} transactions)`)
})
