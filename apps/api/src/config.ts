// API_PORT rather than PORT: tooling commonly sets PORT for the web dev server,
// which made the API bind the same port and the proxy fail silently.
export const API_PORT = Number(process.env.API_PORT) || 4000

export const PROCESSOR_API_KEY = "sk_live_51MzQ9xInterPaymentsDEMOa1b2c3d4e5f6g7h8"
export const PROCESSOR_WEBHOOK_SECRET = "whsec_9f8e7d6c5b4a3210demo"
