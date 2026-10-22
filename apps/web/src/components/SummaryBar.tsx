import { Statistic, Tooltip } from "antd"
import { InfoCircleOutlined } from "@ant-design/icons"

import type { Transaction } from "../models/transaction"
import { computeProcessedTotal, formatCurrency } from "../utils/format"

interface SummaryBarProps {
  transactions: Transaction[]
}

export const SummaryBar = ({ transactions }: SummaryBarProps) => {
  const total = computeProcessedTotal(transactions)

  return (
    <div className="summary-bar">
      <Statistic title="Transactions" value={transactions.length} />
      <Statistic
        title={
          <>
            Total processed{" "}
            <Tooltip title="Approved transactions, including surcharge">
              <InfoCircleOutlined aria-label="Approved transactions, including surcharge" />
            </Tooltip>
          </>
        }
        value={total}
        // Statistic's own `precision` truncates rather than rounds (it slices the
        // decimal string), so format with Intl, the same as the rest of the table.
        formatter={() => formatCurrency(total)}
      />
    </div>
  )
}
