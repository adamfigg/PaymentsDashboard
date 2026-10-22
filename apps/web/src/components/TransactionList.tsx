import { Tag } from "antd"

import type { Transaction } from "../models/transaction"
import { formatCurrency, formatDate } from "../utils/format"
import { statusTagColor } from "../utils/status"

interface TransactionListProps {
  transactions: Transaction[]
  onSelect: (transaction: Transaction) => void
}

export const TransactionList = ({ transactions, onSelect }: TransactionListProps) => {
  return (
    <div className="transaction-list">
      <div className="transaction-row transaction-header">
        <span>Transaction</span>
        <span>Merchant</span>
        <span>Card</span>
        <span>Amount</span>
        <span>Surcharge</span>
        <span>Total</span>
        <span>Status</span>
        <span>Date</span>
      </div>
      {transactions.map((t) => (
        <div className="transaction-row" key={t.id} onClick={() => onSelect(t)}>
          <span className="mono">{t.id}</span>
          <span>{t.merchantName}</span>
          <span>{t.cardBrand}</span>
          <span>{formatCurrency(t.amount)}</span>
          <span>{formatCurrency(t.surcharge)}</span>
          <span>{formatCurrency(t.total)}</span>
          <span>
            <Tag color={statusTagColor(t.status)}>{t.status}</Tag>
          </span>
          <span>{formatDate(t.createdAt)}</span>
        </div>
      ))}
    </div>
  )
}
