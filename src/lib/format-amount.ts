/** Max fractional digits shown in the UI (covers CC/CBTC 10dp and USDCx 6dp). */
const MAX_DISPLAY_DECIMALS = 10;

/**
 * Format a ledger/API amount for display.
 * - Rounds away float dust (e.g. 1.8119299999999998 → 1.81193)
 * - Trims trailing zeros (0.0100000000 → 0.01)
 */
export function formatAmount(value: string | number | null | undefined): string {
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

  // Round via integer scaling to kill binary float residue, then trim zeros.
  const factor = 10 ** MAX_DISPLAY_DECIMALS;
  const rounded = Math.round((n + Number.EPSILON) * factor) / factor;
  // Avoid scientific notation for normal wallet amounts.
  let fixed = rounded.toFixed(MAX_DISPLAY_DECIMALS);
  if (fixed.includes("e") || fixed.includes("E")) {
    fixed = rounded.toLocaleString("en-US", {
      useGrouping: false,
      maximumFractionDigits: MAX_DISPLAY_DECIMALS,
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
