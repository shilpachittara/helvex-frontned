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

/** Ledger decimal places Loop and the token registry will accept. */
const TRANSFER_DECIMALS: Record<string, number> = {
  CC: 10,
  AMULET: 10,
  CBTC: 10,
  USDCX: 6,
  USDCx: 6,
  USDC: 6,
};

/**
 * Amount string safe to hand to Loop.
 *
 * Postgres numeric(28,10) comes back padded (`11.3663200000`). USDCx rejects
 * more than 6 decimal places, and Loop's prepare call then fails with an
 * empty error. Trailing zeros are not a different value — drop them. Refuse
 * a value that still has more places than the token allows.
 */
export function amountForTransfer(symbol: string, raw: string): string {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter a valid amount greater than zero.");
  }
  const key = symbol.trim().toUpperCase();
  const maxDecimals = TRANSFER_DECIMALS[key] ?? TRANSFER_DECIMALS[symbol.trim()] ?? 10;
  const [whole, frac = ""] = trimmed.split(".");
  const fracTrimmed = frac.replace(/0+$/, "");
  if (fracTrimmed.length > maxDecimals) {
    throw new Error(
      `${key || symbol} only supports ${maxDecimals} decimal places.`,
    );
  }
  const wholeNorm = whole.replace(/^0+(?=\d)/, "") || "0";
  const amount = fracTrimmed ? `${wholeNorm}.${fracTrimmed}` : wholeNorm;
  if (!(Number(amount) > 0)) {
    throw new Error("Amount must be greater than zero.");
  }
  return amount;
}
