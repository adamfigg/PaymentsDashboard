export const formatCurrency = (value: number): string => {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleDateString("en-US")
}
