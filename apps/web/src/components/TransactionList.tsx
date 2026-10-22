import { Link, useLocation } from "react-router-dom"
import { Tag } from "antd"
import { CaretDownOutlined, CaretUpOutlined } from "@ant-design/icons"

import type { CardBrand, Transaction, TransactionStatus } from "../models/transaction"
import { CARD_BRANDS, STATUSES } from "../hooks/useListParams"
import type { SortField, SortOrder } from "../services/transaction-service"
import { formatCurrency, formatDate } from "../utils/format"
import { statusTagColor } from "../utils/status"
import { ColumnFilter } from "./ColumnFilter"

type FilterKey = "cardBrands" | "statuses"

// A header either sorts (click to sort, click again to flip) or filters (opens a
// checklist). Card and Status filter: with four or five values, "show me only these"
// is far more useful than sorting them alphabetically.
type Column =
  | {
      kind: "sort"
      field: SortField
      label: string
      // Direction of the first click: biggest/newest first for numbers and dates (what
      // you usually want to see), A→Z for text.
      firstOrder: SortOrder
    }
  | { kind: "filter"; filter: FilterKey; label: string }

const COLUMNS: Column[] = [
  { kind: "sort", field: "id", label: "Transaction", firstOrder: "asc" },
  { kind: "sort", field: "merchantName", label: "Merchant", firstOrder: "asc" },
  { kind: "filter", filter: "cardBrands", label: "Card" },
  { kind: "sort", field: "amount", label: "Amount", firstOrder: "desc" },
  { kind: "sort", field: "surcharge", label: "Surcharge", firstOrder: "desc" },
  { kind: "sort", field: "total", label: "Total", firstOrder: "desc" },
  { kind: "filter", filter: "statuses", label: "Status" },
  { kind: "sort", field: "createdAt", label: "Date", firstOrder: "desc" },
]

// First click on a column uses its natural direction; clicking the active column flips it.
export const nextSort = (field: SortField, current: { sort: SortField; order: SortOrder }) => {
  if (field === current.sort) return { sort: field, order: current.order === "asc" ? "desc" : "asc" } as const
  const column = COLUMNS.find((c) => c.kind === "sort" && c.field === field)
  return { sort: field, order: column?.kind === "sort" ? column.firstOrder : "asc" } as const
}

interface TransactionListProps {
  transactions: Transaction[]
  sort: SortField
  order: SortOrder
  cardBrands: CardBrand[]
  statuses: TransactionStatus[]
  onSort: (field: SortField) => void
  onFilter: (change: { cardBrands: CardBrand[] } | { statuses: TransactionStatus[] }) => void
}

/** Router state passed to the detail page, so its back link returns to this exact view. */
export interface FromListState {
  fromList: string
}

export const TransactionList = ({
  transactions,
  sort,
  order,
  cardBrands,
  statuses,
  onSort,
  onFilter,
}: TransactionListProps) => {
  // The list's current URL (search, filters, sort, page), carried to the detail page.
  const { search } = useLocation()
  const fromList: FromListState = { fromList: `/${search}` }

  const renderHeader = (column: Column) => {
    if (column.kind === "filter") {
      return (
        <span key={column.filter} role="columnheader">
          {column.filter === "cardBrands" ? (
            <ColumnFilter
              label={column.label}
              options={CARD_BRANDS}
              selected={cardBrands}
              onChange={(values) => onFilter({ cardBrands: values })}
            />
          ) : (
            <ColumnFilter
              label={column.label}
              options={STATUSES}
              selected={statuses}
              onChange={(values) => onFilter({ statuses: values })}
              renderOption={(status) => <Tag color={statusTagColor(status)}>{status}</Tag>}
            />
          )}
        </span>
      )
    }

    const active = column.field === sort
    return (
      <span
        key={column.field}
        role="columnheader"
        aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}
      >
        <button type="button" className={`sort-header${active ? " active" : ""}`} onClick={() => onSort(column.field)}>
          {column.label}
          {active && (order === "asc" ? <CaretUpOutlined aria-hidden /> : <CaretDownOutlined aria-hidden />)}
        </button>
      </span>
    )
  }

  return (
    <div className="transaction-list" role="table" aria-label="Transactions">
      <div className="transaction-row transaction-header" role="row">
        {COLUMNS.map(renderHeader)}
      </div>
      {transactions.map((t) => (
        // The id is a real link, stretched over the whole row with CSS (.row-link), so
        // clicking anywhere opens the detail page while middle-click, Ctrl/Cmd-click,
        // "copy link" and keyboard focus all behave like any other link.
        <div className="transaction-row" role="row" key={t.id}>
          <span role="cell" className="mono">
            <Link to={`/transactions/${encodeURIComponent(t.id)}`} state={fromList} className="row-link">
              {t.id}
            </Link>
          </span>
          <span role="cell">{t.merchantName}</span>
          <span role="cell">{t.cardBrand}</span>
          <span role="cell">{formatCurrency(t.amount)}</span>
          <span role="cell">{formatCurrency(t.surcharge)}</span>
          <span role="cell">{formatCurrency(t.total)}</span>
          <span role="cell">
            <Tag color={statusTagColor(t.status)}>{t.status}</Tag>
          </span>
          <span role="cell">{formatDate(t.createdAt)}</span>
        </div>
      ))}
    </div>
  )
}
