export enum CardBrand {
  VISA = "VISA",
  MASTERCARD = "MASTERCARD",
  AMEX = "AMEX",
  DISCOVER = "DISCOVER",
}

export enum TransactionStatus {
  APPROVED = "APPROVED",
  DECLINED = "DECLINED",
  REFUNDED = "REFUNDED",
  PENDING = "PENDING",
  // Present in the data (one row) but missing from the original enum.
  VOIDED = "VOIDED",
}

export interface Transaction {
  id: string
  merchantName: string
  cardBrand: CardBrand
  amount: number
  surchargeRate: number
  surcharge: number
  total: number
  status: TransactionStatus
  createdAt: string
}
