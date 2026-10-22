import { useEffect } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { Alert, Button, Descriptions, Result, Spin, Tag, Typography } from "antd"
import { ArrowLeftOutlined } from "@ant-design/icons"

import type { FromListState } from "../components/TransactionList"
import { useFetch } from "../hooks/useFetch"
import type { Transaction } from "../models/transaction"
import { ApiError, transactionUrl } from "../services/transaction-service"
import { formatCurrency, formatDateTime, formatRate } from "../utils/format"
import { statusTagColor } from "../utils/status"

export const TransactionDetailPage = () => {
  const { id = "" } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  // Back to the exact list view the user came from (search, filters, sort, page). If
  // they arrived directly (a shared link, a new tab), there's no state: go to the
  // default dashboard.
  const backTo = (location.state as FromListState | null)?.fromList ?? "/"
  const { data: transaction, error, loading, retry } = useFetch<Transaction>(transactionUrl(id))

  useEffect(() => {
    document.title = `${id} · Transactions`
    return () => {
      document.title = "InterPayments · Transactions"
    }
  }, [id])

  const backLink = (
    <Link to={backTo} className="back-link">
      <ArrowLeftOutlined /> Transactions
    </Link>
  )

  // useFetch keeps the previous result while a new id loads, so only trust data for this id.
  const current = transaction?.id === id ? transaction : undefined

  if (!current && loading) {
    return (
      <div className="detail-page">
        {backLink}
        <div className="app-loading">
          <Spin size="large" />
        </div>
      </div>
    )
  }

  if (!current && error instanceof ApiError && error.status === 404) {
    return (
      <div className="detail-page">
        {backLink}
        <Result
          status="404"
          title="Transaction not found"
          subTitle={
            <>
              There's no transaction with the id <Typography.Text code>{id}</Typography.Text>. It may have been
              mistyped, or the link may be out of date.
            </>
          }
          extra={
            <Button type="primary" onClick={() => navigate(backTo)}>
              Back to transactions
            </Button>
          }
        />
      </div>
    )
  }

  if (!current) {
    return (
      <div className="detail-page">
        {backLink}
        <Alert
          type="error"
          showIcon
          message="Couldn't load this transaction"
          description={error?.message}
          action={<Button onClick={retry}>Retry</Button>}
        />
      </div>
    )
  }

  const t = current
  return (
    <div className="detail-page">
      {backLink}

      <header className="detail-header">
        <div>
          <h2>
            <Typography.Text copyable={{ text: t.id, tooltips: ["Copy id", "Copied"] }} className="mono detail-id">
              {t.id}
            </Typography.Text>
          </h2>
          <div className="detail-subtitle">
            {t.merchantName} · {formatDateTime(t.createdAt)}
          </div>
        </div>
        <Tag color={statusTagColor(t.status)} className="detail-status">
          {t.status}
        </Tag>
      </header>

      <section className="detail-card" aria-labelledby="payment-heading">
        <h3 id="payment-heading">Payment</h3>
        <dl className="detail-amounts">
          <div>
            <dt>Amount</dt>
            <dd>{formatCurrency(t.amount)}</dd>
          </div>
          <div>
            <dt>Surcharge ({formatRate(t.surchargeRate)})</dt>
            <dd>{formatCurrency(t.surcharge)}</dd>
          </div>
          <div className="detail-total">
            <dt>Total charged</dt>
            <dd>{formatCurrency(t.total)}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-card" aria-labelledby="details-heading">
        <h3 id="details-heading">Details</h3>
        <Descriptions
          column={1}
          size="small"
          bordered
          items={[
            {
              key: "merchant",
              label: "Merchant",
              children: (
                <>
                  {t.merchantName}{" "}
                  <Link to={`/?q=${encodeURIComponent(t.merchantName)}`} className="detail-related">
                    View all from this merchant
                  </Link>
                </>
              ),
            },
            { key: "card", label: "Card brand", children: t.cardBrand },
            { key: "status", label: "Status", children: <Tag color={statusTagColor(t.status)}>{t.status}</Tag> },
            { key: "created", label: "Created", children: formatDateTime(t.createdAt) },
            { key: "id", label: "Transaction ID", children: <span className="mono">{t.id}</span> },
          ]}
        />
      </section>

      {/* A newer request for this page failed after it had loaded (e.g. a retry). */}
      {error && (
        <Alert
          type="warning"
          showIcon
          message="Couldn't refresh. Showing the last loaded details."
          action={<Button onClick={retry}>Retry</Button>}
        />
      )}
    </div>
  )
}
