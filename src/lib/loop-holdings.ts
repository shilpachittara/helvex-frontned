/** One token row from the connected Loop wallet (`Provider.getHolding`). */
export interface LoopHoldingView {
  symbol: string;
  instrumentId: string;
  instrumentAdmin: string;
  unlocked: string;
  locked: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Normalize the Loop SDK holdings payload. Non-arrays become an empty list. */
export function parseLoopHoldings(raw: unknown): LoopHoldingView[] {
  const record = asRecord(raw);
  const list = Array.isArray(raw) ? raw : record?.holdings ?? record?.data;
  if (!Array.isArray(list)) return [];
  const rows: LoopHoldingView[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const instrument = row.instrument_id;
    let instrumentId = "";
    let instrumentAdmin = "";
    if (typeof instrument === "string") {
      instrumentId = instrument;
    } else {
      const inst = asRecord(instrument);
      instrumentId = text(inst?.id);
      instrumentAdmin = text(inst?.admin);
    }
    const symbol = text(row.symbol) || instrumentId;
    if (!symbol && !instrumentId) continue;
    rows.push({
      symbol,
      instrumentId,
      instrumentAdmin,
      unlocked: text(row.total_unlocked_coin) || "0",
      locked: text(row.total_locked_coin) || "0",
    });
  }
  return rows;
}

function namesFor(symbol: string): Set<string> {
  const want = symbol.trim().toUpperCase();
  const names = new Set<string>([want]);
  if (want === "CC" || want === "AMULET") {
    names.add("CC");
    names.add("AMULET");
  }
  if (want === "USDCX" || want === "USDC") {
    names.add("USDCX");
    names.add("USDC");
  }
  return names;
}

function matchesSymbol(holding: LoopHoldingView, symbol: string): boolean {
  const names = namesFor(symbol);
  return names.has(holding.symbol.trim().toUpperCase()) || names.has(holding.instrumentId.trim().toUpperCase());
}

/** Unlocked Loop balance for a token. Missing holdings are zero. */
export function unlockedForSymbol(holdings: LoopHoldingView[], symbol: string): string {
  const match = holdings.find((holding) => matchesSymbol(holding, symbol));
  return match?.unlocked || "0";
}
