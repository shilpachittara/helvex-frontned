/** Trim trailing zeros from decimal amount strings (e.g. 0.0100000000 → 0.01). */
export function formatAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && !Number.isFinite(value)) return "—";
  const raw = String(value).trim();
  if (!raw) return raw;
  // Reject NaN / scientific notation / anything not a plain decimal.
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return raw === "NaN" || raw === "undefined" ? "—" : raw;

  const negative = raw.startsWith("-");
  const abs = negative ? raw.slice(1) : raw;
  const [intPart, fracPart = ""] = abs.split(".");

  const trimmedFrac = fracPart.replace(/0+$/, "");
  const normalizedInt = intPart.replace(/^0+(?=\d)/, "") || "0";
  const formatted = trimmedFrac ? `${normalizedInt}.${trimmedFrac}` : normalizedInt;

  return negative ? `-${formatted}` : formatted;
}
