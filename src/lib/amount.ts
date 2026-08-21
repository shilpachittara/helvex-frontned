/**
 * Client-side mirror of the backend `positiveAmountString` rule: a plain
 * non-negative decimal string that is strictly greater than zero. Used to gate
 * deposit/withdraw/transfer/fill submits before hitting the API.
 */
export function isValidAmount(raw: string): boolean {
  return /^\d+(\.\d+)?$/.test(raw.trim()) && Number.parseFloat(raw) > 0;
}

/**
 * The exact string to send to the API for an amount the user typed.
 *
 * `isValidAmount` deliberately tolerates surrounding whitespace so a stray
 * space while typing does not disable the submit button — but the backend
 * schema (`/^\d+(\.\d+)?$/`, no trim) rejects it. Submitting the raw state
 * therefore fails validation on a value the UI just called valid: "0.0003 "
 * was rejected as `Invalid request` on 20 Aug 2026.
 *
 * For intents this matters twice over: the amount is part of the SIGNED
 * canonical payload, so it must be normalised *before* signing. Trimming
 * server-side would change the bytes the signature covers and break
 * verification.
 *
 * Always pass user-entered amounts through this on the way to the API.
 */
export function normalizeAmount(raw: string): string {
  return raw.trim();
}
