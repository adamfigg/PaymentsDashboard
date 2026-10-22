import { TransactionStatus } from "../models/transaction"

export const statusTagColor = (status: TransactionStatus): string => {
  switch (status) {
    case TransactionStatus.APPROVED:
      return "success"
    case TransactionStatus.DECLINED:
      return "error"
    case TransactionStatus.PENDING:
      return "warning"
    case TransactionStatus.REFUNDED:
    case TransactionStatus.VOIDED:
      return "default"
    default:
      // A status the API sends that this build doesn't know yet: render it plainly
      // instead of passing `undefined` as a color.
      return "default"
  }
}
