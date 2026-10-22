// API_PORT rather than PORT: tooling commonly sets PORT for the web dev server,
// which made the API bind the same port and the proxy fail silently.
export const API_PORT = Number(process.env.API_PORT) || 4000

export type SecretName = "PROCESSOR_API_KEY" | "PROCESSOR_WEBHOOK_SECRET"

// Secrets come from the environment only: apps/api/.env locally (gitignored, loaded
// by the dev/start scripts), the platform's secret store in production. They're never
// committed. They're read when used rather than at startup, so the API still boots
// for local work without processor credentials, and whatever needs one fails loudly
// instead of sending an empty value.
export const requireSecret = (name: SecretName): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required secret ${name}. Set it in apps/api/.env (see .env.example).`)
  }
  return value
}
