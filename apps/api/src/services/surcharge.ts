import { PERCENT_SCALE } from "../utils/money.js"

// Stand-in for a real surcharge rules engine. In production the allowed rate depends
// on the card program (debit can't be surcharged), the merchant's registration and
// state law, not a single constant.
export const SURCHARGE_CONFIG = {
  /** Pre-filled on the form; also used when a request doesn't specify a surcharge. */
  defaultMilliPercent: 3 * PERCENT_SCALE,
  /** Hard limit. Anything above is rejected as almost certainly a typo. */
  maxMilliPercent: 10 * PERCENT_SCALE,
  /** The common card-network cap. The form warns above it but doesn't block. */
  typicalCapMilliPercent: 3 * PERCENT_SCALE,
}

export const surchargeConfigResponse = () => ({
  defaultPercent: SURCHARGE_CONFIG.defaultMilliPercent / PERCENT_SCALE,
  maxPercent: SURCHARGE_CONFIG.maxMilliPercent / PERCENT_SCALE,
  typicalCapPercent: SURCHARGE_CONFIG.typicalCapMilliPercent / PERCENT_SCALE,
})
