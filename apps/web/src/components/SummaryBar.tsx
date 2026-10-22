import { Statistic, Tooltip } from "antd"
import { InfoCircleOutlined } from "@ant-design/icons"

import type { TransactionSummary } from "../services/transaction-service"
import { formatCurrency } from "../utils/format"

interface SummaryBarProps {
  // Computed by the server over the whole search result, not just the page on screen.
  summary: TransactionSummary | undefined
  loading: boolean
}

export const SummaryBar = ({ summary, loading }: SummaryBarProps) => {
  return (
    <div className="summary-bar">
      <Statistic title="Transactions" value={summary?.count ?? "—"} loading={loading} />
      <Statistic
        title={
          <>
            Total processed{" "}
            <Tooltip title="Approved transactions, including surcharge">
              <InfoCircleOutlined aria-label="Approved transactions, including surcharge" />
            </Tooltip>
          </>
        }
        value={summary?.processedTotal ?? "—"}
        loading={loading}
        // Statistic's own `precision` truncates rather than rounds (it slices the
        // decimal string), so format with Intl, the same as the rest of the table.
        formatter={() => (summary ? formatCurrency(summary.processedTotal) : "—")}
      />
    </div>
  )
}
