import { useEffect, useRef, useState } from "react"
import { Alert, Button, Empty, Input, Pagination, Spin } from "antd"
import { SearchOutlined } from "@ant-design/icons"

import { SummaryBar } from "../components/SummaryBar"
import { TransactionList } from "../components/TransactionList"
import { TransactionModal } from "../components/TransactionModal"
import { useDebouncedValue } from "../hooks/useDebouncedValue"
import { PAGE_SIZE_OPTIONS, useListParams } from "../hooks/useListParams"
import { useTransactionSummary, useTransactions } from "../hooks/useTransactions"
import type { Transaction } from "../models/transaction"

// Long enough to skip the intermediate states of a word, short enough to feel live.
const SEARCH_DEBOUNCE_MS = 300

export const TransactionsPage = () => {
  // The URL is the source of truth for what's fetched; the input has its own state so
  // typing stays instant and only the settled value reaches the URL (and the API).
  const [params, setParams] = useListParams()
  const { page, pageSize, q } = params
  const [searchInput, setSearchInput] = useState(q)
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS)
  // The last search the input and the URL agreed on. It tells a URL change we made
  // apart from one that came from outside (back/forward, a pasted link).
  const syncedQ = useRef(q)
  const [selected, setSelected] = useState<Transaction | null>(null)

  const commitSearch = (value: string) => {
    const next = value.trim()
    if (next === syncedQ.current) return
    // Starting or clearing a search gets its own history entry, so Back returns to the
    // view before it. Refining an existing search replaces the entry, so "blu" → "blue"
    // isn't a separate Back step per word.
    const refining = syncedQ.current !== "" && next !== ""
    syncedQ.current = next
    // A new search starts from page 1.
    setParams({ q: next, page: 1 }, { replace: refining })
  }

  // Input → URL, once typing pauses.
  useEffect(() => {
    commitSearch(debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the settled value
  }, [debouncedSearch])

  // URL → input, when the URL changed from outside.
  useEffect(() => {
    if (q === syncedQ.current) return
    syncedQ.current = q
    setSearchInput(q)
  }, [q])

  const list = useTransactions(params)
  const summary = useTransactionSummary(q)
  const result = list.data

  // If the current page no longer exists (e.g. the result set shrank), jump to the
  // last page that does rather than showing an empty table.
  useEffect(() => {
    if (result && result.data.length === 0 && result.totalPages > 0 && page > result.totalPages) {
      setParams({ page: result.totalPages }, { replace: true })
    }
  }, [result, page, setParams])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    // Clearing is a deliberate action, not a keystroke mid-word, so don't make it wait.
    if (value === "") commitSearch(value)
  }

  const handlePageChange = (nextPage: number, nextPageSize: number) => {
    // A new page size changes what every page number means, so start from the top.
    // Paging pushes history, so Back returns to the previous page.
    setParams({ page: nextPageSize === pageSize ? nextPage : 1, pageSize: nextPageSize })
    window.scrollTo({ top: 0 })
  }

  const retry = () => {
    list.retry()
    summary.retry()
  }

  const renderBody = () => {
    // First load: nothing to show yet.
    if (!result && list.loading) {
      return (
        <div className="app-loading">
          <Spin size="large" />
        </div>
      )
    }

    // Failed with nothing to fall back on.
    if (!result) {
      return (
        <Alert
          type="error"
          showIcon
          message="Couldn't load transactions"
          description={list.error?.message}
          action={<Button onClick={retry}>Retry</Button>}
        />
      )
    }

    if (result.total === 0) {
      return (
        <div className="transaction-list transaction-empty">
          <Empty description={q ? `No transactions match "${q}"` : "No transactions yet"} />
        </div>
      )
    }

    // Keep showing the current rows (dimmed) while the next page loads.
    return (
      <>
        <Spin spinning={list.loading}>
          <TransactionList transactions={result.data} onSelect={setSelected} />
        </Spin>
        <Pagination
          className="transaction-pagination"
          current={result.page}
          pageSize={result.pageSize}
          total={result.total}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          showSizeChanger
          showTotal={(total, [from, to]) => `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
          onChange={handlePageChange}
        />
      </>
    )
  }

  // A failure while stale rows are on screen: say so, but keep the rows.
  const staleError = result && (list.error ?? summary.error)

  return (
    <>
      <header className="app-header">
        <h1>Transactions</h1>
        <Input
          style={{ width: 320 }}
          prefix={<SearchOutlined />}
          allowClear
          placeholder="Search merchant, id, card, status..."
          aria-label="Search transactions"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          onPressEnter={() => commitSearch(searchInput)}
        />
      </header>

      <SummaryBar summary={summary.data} loading={summary.loading && !summary.data} />

      {staleError && (
        <Alert
          className="stale-error"
          type="warning"
          showIcon
          message="Couldn't refresh. Showing the last results."
          description={staleError.message}
          action={<Button onClick={retry}>Retry</Button>}
        />
      )}

      {renderBody()}

      <TransactionModal transaction={selected} onClose={() => setSelected(null)} />
    </>
  )
}
