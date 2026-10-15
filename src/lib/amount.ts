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

/**
 * True when a typed amount is strictly above the available balance.
 * Missing or unreadable available balance is treated as zero.
 */
export function exceedsAvailable(requested: string, available: string): boolean {
  if (!isValidAmount(requested)) return false;
  return comparePositiveDecimals(normalizeAmount(requested), available) > 0;
}

/** Decimal places accepted for a sell amount of this token. */
export function sellDecimals(symbol: string): number {
  const key = symbol.trim().toUpperCase();
  return TRANSFER_DECIMALS[key] ?? TRANSFER_DECIMALS[symbol.trim()] ?? 10;
}

/**
 * Smallest sell amount that clears the token minimums and the USD trade floor.
 * Returns null when `sellAmount` is already large enough, or when the quote
 * cannot be scaled (missing price, or already above the USD maximum).
 *
 * A 2% cushion keeps a price tick from landing the next quote back under $10.
 */
export function raisedSellAmount(input: {
  sellAmount: string;
  notionalUsd: number;
  minNotionalUsd: number;
  maxNotionalUsd: number;
  rate: number;
  minBuy: string;
  minSell: string;
  sellDecimals: number;
}): string | null {
  const sell = Number(input.sellAmount);
  if (!(sell > 0) || !Number.isFinite(sell)) return null;
  if (input.maxNotionalUsd > 0 && input.notionalUsd > input.maxNotionalUsd) return null;

  let need = Math.max(sell, Number(input.minSell) || 0);
  const usdPerUnit = input.notionalUsd / sell;
  if (input.minNotionalUsd > 0 && input.notionalUsd < input.minNotionalUsd && usdPerUnit > 0) {
    need = Math.max(need, input.minNotionalUsd / usdPerUnit);
  }
  const minBuy = Number(input.minBuy);
  if (minBuy > 0 && input.rate > 0 && sell * input.rate < minBuy) {
    need = Math.max(need, minBuy / input.rate);
  }
  if (!(need > sell * 1.0000001)) return null;

  const cushion = input.minNotionalUsd > 0 && input.notionalUsd < input.minNotionalUsd ? 1.02 : 1;
  return ceilDecimal(need * cushion, input.sellDecimals);
}

function ceilDecimal(value: number, decimals: number): string {
  const places = Math.max(0, Math.min(18, Math.floor(decimals)));
  const factor = 10 ** places;
  const ceiled = Math.ceil(value * factor - 1e-8) / factor;
  const fixed = ceiled.toFixed(places);
  const [whole, frac = ""] = fixed.split(".");
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${whole.replace(/^0+(?=\d)/, "") || "0"}.${trimmed}` : whole.replace(/^0+(?=\d)/, "") || "0";
}

function comparePositiveDecimals(left: string, right: string): number {
  const parse = (raw: string): [string, string] => {
    const trimmed = raw.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return ["0", ""];
    const [whole, frac = ""] = trimmed.split(".");
    return [whole.replace(/^0+/, "") || "0", frac.replace(/0+$/, "")];
  };
  const [lw, lf] = parse(left);
  const [rw, rf] = parse(right);
  const scale = Math.max(lf.length, rf.length);
  const l = BigInt(lw + lf.padEnd(scale, "0"));
  const r = BigInt(rw + rf.padEnd(scale, "0"));
  if (l > r) return 1;
  if (l < r) return -1;
  return 0;
}
