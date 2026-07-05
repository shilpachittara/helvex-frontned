/**
 * Client-side mirror of the backend `positiveAmountString` rule: a plain
 * non-negative decimal string that is strictly greater than zero. Used to gate
 * deposit/withdraw/transfer/fill submits before hitting the API.
 */
export function isValidAmount(raw: string): boolean {
  return /^\d+(\.\d+)?$/.test(raw.trim()) && Number.parseFloat(raw) > 0;
}
