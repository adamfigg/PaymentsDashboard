import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Alert, Button, Form, Input, Select, Spin, Tag, message } from "antd"
import { ArrowLeftOutlined } from "@ant-design/icons"

import { useFetch } from "../hooks/useFetch"
import { CARD_BRANDS, STATUSES } from "../hooks/useListParams"
import { TransactionStatus } from "../models/transaction"
import type { CardBrand } from "../models/transaction"
import { ApiError, SURCHARGE_CONFIG_URL, createTransaction } from "../services/transaction-service"
import type { NewTransactionInput, SurchargeConfig } from "../services/transaction-service"
import {
  PERCENT_SCALE,
  centsToInput,
  formatCents,
  milliPercentOf,
  milliPercentToInput,
  parseDollars,
  parsePercent,
  percentOfCents,
} from "../utils/money"
import { statusTagColor } from "../utils/status"

const MAX_MERCHANT_LENGTH = 100
const MAX_AMOUNT_CENTS = 100_000_000

interface FormValues {
  merchantName: string
  cardBrand?: CardBrand
  status: TransactionStatus
  amount: string
  surchargePercent: string
  surcharge: string
}

// Which surcharge input the user typed in last. That one is the source of truth: it's
// what gets sent, and the other is derived from it.
type SurchargeMode = "percent" | "amount"

const newIdempotencyKey = () => crypto.randomUUID()

export const NewTransactionPage = () => {
  const config = useFetch<SurchargeConfig>(SURCHARGE_CONFIG_URL)

  if (!config.data) {
    return (
      <div className="new-transaction">
        {config.error ? (
          <Alert
            type="error"
            showIcon
            message="Couldn't load the surcharge settings"
            description={config.error.message}
            action={<Button onClick={config.retry}>Retry</Button>}
          />
        ) : (
          <div className="app-loading">
            <Spin size="large" />
          </div>
        )}
      </div>
    )
  }

  return <NewTransactionForm config={config.data} />
}

const NewTransactionForm = ({ config }: { config: SurchargeConfig }) => {
  const navigate = useNavigate()
  const [form] = Form.useForm<FormValues>()
  const [mode, setMode] = useState<SurchargeMode>("percent")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  // One key per intended submission: a retry of the same values reuses it (so a
  // request that timed out after succeeding isn't created twice); any edit makes a new one.
  const idempotencyKey = useRef(newIdempotencyKey())

  // The rules only check the active surcharge input, so re-run them when it changes
  // (clears a stale error on the one that's now derived).
  useEffect(() => {
    form.validateFields(["surchargePercent", "surcharge"]).catch(() => {})
  }, [mode, form])

  const maxMilli = config.maxPercent * PERCENT_SCALE
  const capMilli = config.typicalCapPercent * PERCENT_SCALE

  // Watched so the preview re-renders as the user types.
  const amountRaw = Form.useWatch("amount", form) ?? ""
  const percentRaw = Form.useWatch("surchargePercent", form) ?? ""
  const surchargeRaw = Form.useWatch("surcharge", form) ?? ""

  const amountCents = parseDollars(amountRaw)
  const preview = (() => {
    if (amountCents === null || amountCents === 0) return null
    if (mode === "percent") {
      const milli = parsePercent(percentRaw)
      return milli === null ? null : { surchargeCents: percentOfCents(amountCents, milli), milli }
    }
    const surchargeCents = parseDollars(surchargeRaw)
    return surchargeCents === null ? null : { surchargeCents, milli: milliPercentOf(surchargeCents, amountCents) }
  })()

  // Keep the two surcharge inputs in step. Only fill in the derived one; never
  // overwrite the field the user is typing in.
  const handleValuesChange = (changed: Partial<FormValues>, all: FormValues) => {
    idempotencyKey.current = newIdempotencyKey()
    setSubmitError(undefined)

    const nextMode: SurchargeMode = "surcharge" in changed ? "amount" : "surchargePercent" in changed ? "percent" : mode
    if (nextMode !== mode) setMode(nextMode)
    if (!("amount" in changed || "surcharge" in changed || "surchargePercent" in changed)) return

    const amount = parseDollars(all.amount ?? "")
    if (amount === null) return
    if (nextMode === "percent") {
      const milli = parsePercent(all.surchargePercent ?? "")
      if (milli !== null) form.setFieldValue("surcharge", centsToInput(percentOfCents(amount, milli)))
    } else {
      const surcharge = parseDollars(all.surcharge ?? "")
      if (surcharge !== null && amount > 0) {
        form.setFieldValue("surchargePercent", milliPercentToInput(milliPercentOf(surcharge, amount)))
      }
    }
  }

  // Tidy a valid amount on blur ("1,234.5" → "1234.50") so what's shown is what's sent.
  const tidyDollars = (field: "amount" | "surcharge") => {
    const cents = parseDollars(form.getFieldValue(field) ?? "")
    if (cents !== null) form.setFieldValue(field, centsToInput(cents))
  }

  const handleSubmit = async (values: FormValues) => {
    const amount = parseDollars(values.amount)
    if (amount === null || !values.cardBrand) return
    const input: NewTransactionInput = {
      merchantName: values.merchantName.trim(),
      cardBrand: values.cardBrand,
      status: values.status,
      amount: centsToInput(amount),
      ...(mode === "percent"
        ? { surchargePercent: milliPercentToInput(parsePercent(values.surchargePercent) ?? 0) }
        : { surcharge: centsToInput(parseDollars(values.surcharge) ?? 0) }),
    }

    setSubmitting(true)
    setSubmitError(undefined)
    try {
      const created = await createTransaction(input, idempotencyKey.current)
      message.success(`Transaction ${created.id} created`)
      // Straight to the new transaction. `replace` so Back goes to wherever the user
      // was before the form, not back into a form that's already been submitted.
      navigate(`/transactions/${encodeURIComponent(created.id)}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        // Show the server's messages under the matching inputs. A surcharge error
        // belongs on whichever surcharge input the user was using.
        const { surcharge, ...rest } = err.fieldErrors
        form.setFields([
          ...Object.entries(rest).map(([name, msg]) => ({ name: name as keyof FormValues, errors: [msg] })),
          ...(surcharge ? [{ name: (mode === "percent" ? "surchargePercent" : "surcharge") as keyof FormValues, errors: [surcharge] }] : []),
        ])
      } else {
        // Network failure or a server error: keep everything the user typed.
        setSubmitError(err instanceof Error ? err.message : "Something went wrong")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const amountRule = {
    validator: (_: unknown, value: string = "") => {
      if (!value.trim()) return Promise.reject(new Error("Enter an amount"))
      const cents = parseDollars(value)
      if (cents === null) return Promise.reject(new Error("Enter an amount like 12.34 (at most 2 decimal places)"))
      if (cents === 0) return Promise.reject(new Error("Amount must be more than $0.00"))
      if (cents > MAX_AMOUNT_CENTS) return Promise.reject(new Error("Amount can't be more than $1,000,000.00"))
      return Promise.resolve()
    },
  }

  const tooHigh = `Surcharge can't be more than ${config.maxPercent}% of the amount`
  const percentRule = {
    validator: (_: unknown, value: string = "") => {
      if (mode !== "percent") return Promise.resolve()
      const milli = parsePercent(value)
      if (milli === null) return Promise.reject(new Error("Enter a rate like 3 or 3.5"))
      if (milli > maxMilli) return Promise.reject(new Error(tooHigh))
      return Promise.resolve()
    },
  }
  const surchargeRule = {
    validator: (_: unknown, value: string = "") => {
      if (mode !== "amount") return Promise.resolve()
      const cents = parseDollars(value)
      if (cents === null) return Promise.reject(new Error("Enter a surcharge like 0.39"))
      if (amountCents && cents * 100_000 > amountCents * maxMilli) return Promise.reject(new Error(tooHigh))
      return Promise.resolve()
    },
  }

  return (
    <div className="new-transaction">
      <Link to="/" className="back-link">
        <ArrowLeftOutlined /> Transactions
      </Link>
      <h2>New transaction</h2>

      {submitError && (
        <Alert
          className="form-error"
          type="error"
          showIcon
          message="Couldn't create the transaction"
          description={`${submitError}. Your details are kept; try again.`}
        />
      )}

      <Form<FormValues>
        form={form}
        layout="vertical"
        disabled={submitting}
        initialValues={{
          merchantName: "",
          status: TransactionStatus.PENDING,
          amount: "",
          surchargePercent: String(config.defaultPercent),
          surcharge: "",
        }}
        onValuesChange={handleValuesChange}
        onFinish={handleSubmit}
        className="form-card"
      >
        <Form.Item
          label="Merchant"
          name="merchantName"
          rules={[
            { required: true, whitespace: true, message: "Enter a merchant name" },
            { max: MAX_MERCHANT_LENGTH, message: `Merchant name must be ${MAX_MERCHANT_LENGTH} characters or fewer` },
          ]}
        >
          <Input placeholder="e.g. Blue Ridge Outfitters" maxLength={MAX_MERCHANT_LENGTH} />
        </Form.Item>

        <div className="form-row">
          <Form.Item label="Card brand" name="cardBrand" rules={[{ required: true, message: "Choose a card brand" }]}>
            <Select placeholder="Choose a card brand" options={CARD_BRANDS.map((b) => ({ value: b, label: b }))} />
          </Form.Item>
          <Form.Item label="Status" name="status" rules={[{ required: true, message: "Choose a status" }]}>
            <Select
              options={STATUSES.map((s) => ({ value: s, label: <Tag color={statusTagColor(s)}>{s}</Tag> }))}
            />
          </Form.Item>
        </div>

        <Form.Item label="Amount" name="amount" required rules={[amountRule]}>
          <Input prefix="$" placeholder="0.00" inputMode="decimal" onBlur={() => tidyDollars("amount")} />
        </Form.Item>

        <div className="form-row surcharge-row">
          <Form.Item
            label="Surcharge rate"
            name="surchargePercent"
            rules={[percentRule]}
            dependencies={["amount"]}
            extra={`Default ${config.defaultPercent}%`}
          >
            <Input suffix="%" inputMode="decimal" />
          </Form.Item>
          <span className="surcharge-or" aria-hidden>
            or
          </span>
          <Form.Item label="Surcharge amount" name="surcharge" rules={[surchargeRule]} dependencies={["amount"]}>
            <Input prefix="$" placeholder="0.00" inputMode="decimal" onBlur={() => tidyDollars("surcharge")} />
          </Form.Item>
        </div>

        {preview && preview.milli > capMilli && preview.milli <= maxMilli && (
          <Alert
            className="form-warning"
            type="warning"
            showIcon
            message={`Above the ${config.typicalCapPercent}% cap most card networks allow`}
            description="Check that this merchant is permitted to surcharge at this rate."
          />
        )}

        <dl className="form-preview" aria-live="polite">
          <div>
            <dt>Amount</dt>
            <dd>{amountCents ? formatCents(amountCents) : "—"}</dd>
          </div>
          <div>
            <dt>Surcharge{preview ? ` (${(preview.milli / PERCENT_SCALE).toFixed(preview.milli % 100 ? 3 : 1)}%)` : ""}</dt>
            <dd>{preview ? formatCents(preview.surchargeCents) : "—"}</dd>
          </div>
          <div className="form-preview-total">
            <dt>Total</dt>
            <dd>{preview && amountCents ? formatCents(amountCents + preview.surchargeCents) : "—"}</dd>
          </div>
        </dl>

        <div className="form-actions">
          <Button onClick={() => navigate("/")} disabled={submitting}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Create transaction
          </Button>
        </div>
      </Form>
    </div>
  )
}
