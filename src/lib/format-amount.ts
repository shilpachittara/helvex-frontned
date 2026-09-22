/** Max fractional digits shown in the UI (covers CC/CBTC 10dp and USDCx 6dp). */
const MAX_DISPLAY_DECIMALS = 10;

/** Per-asset display cap so balance cards don't overflow into each other. */
const BALANCE_DISPLAY_DECIMALS: Record<string, number> = {
  CC: 4,
  Amulet: 4,
  CBTC: 8,
  USDCX: 2,
  USDCx: 2,
};

/**
 * Format a ledger/API amount for display.
 * - Rounds away float dust (e.g. 1.8119299999999998 → 1.81193)
 * - Trims trailing zeros (0.0100000000 → 0.01)
 */
export function formatAmount(
  value: string | number | null | undefined,
  maxDecimals: number = MAX_DISPLAY_DECIMALS,
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && !Number.isFinite(value)) return "—";
  const raw = String(value).trim();
  if (!raw) return raw;
  if (raw === "NaN" || raw === "undefined" || raw === "Infinity" || raw === "-Infinity") {
    return "—";
  }

  // Accept plain decimals and scientific notation from JS number coercion.
  const n = typeof value === "number" ? value : Number(raw);
  if (!Number.isFinite(n)) {
    // Keep non-numeric passthrough for unexpected API shapes.
    return /^-?\d+(\.\d+)?$/.test(raw) ? raw : raw;
  }

  const decimals = Math.max(0, Math.min(MAX_DISPLAY_DECIMALS, Math.floor(maxDecimals)));
  // Round via integer scaling to kill binary float residue, then trim zeros.
  const factor = 10 ** decimals;
  const rounded = Math.round((n + Number.EPSILON) * factor) / factor;
  // Avoid scientific notation for normal wallet amounts.
  let fixed = rounded.toFixed(decimals);
  if (fixed.includes("e") || fixed.includes("E")) {
    fixed = rounded.toLocaleString("en-US", {
      useGrouping: false,
      maximumFractionDigits: decimals,
    });
  }

  const negative = fixed.startsWith("-");
  const abs = negative ? fixed.slice(1) : fixed;
  const [intPart, fracPart = ""] = abs.split(".");
  const trimmedFrac = fracPart.replace(/0+$/, "");
  const normalizedInt = intPart.replace(/^0+(?=\d)/, "") || "0";
  const formatted = trimmedFrac ? `${normalizedInt}.${trimmedFrac}` : normalizedInt;
  return negative ? `-${formatted}` : formatted;
}

/** Compact amount for trading-balance cards / chips. */
export function formatBalanceAmount(
  value: string | number | null | undefined,
  symbol?: string,
): string {
  const key = (symbol ?? "").trim();
  const max = BALANCE_DISPLAY_DECIMALS[key] ?? 6;
  return formatAmount(value, max);
}
