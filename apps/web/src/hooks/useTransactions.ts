import type { Filters, ListParams, TransactionPage, TransactionSummary } from "../services/transaction-service"
import { summaryUrl, transactionsUrl } from "../services/transaction-service"
import { useFetch } from "./useFetch"

export const useTransactions = (params: ListParams) => useFetch<TransactionPage>(transactionsUrl(params))

// Separate request from the page: it only depends on the filters, so paging and
// sorting don't refetch it, and at scale it can be cached or degraded on its own.
export const useTransactionSummary = ({ q, cardBrands, statuses }: Filters) =>
  useFetch<TransactionSummary>(summaryUrl({ q, cardBrands, statuses }))
