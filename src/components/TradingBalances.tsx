"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBalances, type BalanceView } from "../lib/api";
import { formatBalanceAmount } from "../lib/format-amount";

const DISPLAY_SYMBOLS = ["CC", "CBTC", "USDCx"] as const;

function displayRows(balances: BalanceView[]): BalanceView[] {
  return DISPLAY_SYMBOLS.map((symbol) => {
    const match = balances.find(
      (b) =>
        b.symbol === symbol ||
        b.instrument === symbol ||
        (symbol === "CC" && (b.instrument === "Amulet" || b.symbol === "Amulet")),
    );
    return (
      match ?? {
        instrument: symbol,
        symbol,
        total: "0",
        locked: "0",
        available: "0",
      }
    );
  });
}

/** `enabled` is a logged-in session (or resolved app party). Balances use the session, not the header. */
export function useTradingBalances(enabled: string | boolean | null) {
  const [balances, setBalances] = useState<BalanceView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = Boolean(enabled);
  const appParty = typeof enabled === "string" ? enabled : null;

  const refresh = useCallback(async () => {
    if (!ready) {
      setBalances([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchBalances(appParty);
      setBalances(res.balances ?? []);
    } catch (err) {
      setBalances([]);
      setError(err instanceof Error ? err.message : "Failed to load balances");
    } finally {
      setLoading(false);
    }
  }, [ready, appParty]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balances, loading, error, refresh };
}

export function availableForSymbol(balances: BalanceView[], symbol: string): string | null {
  const match = balances.find(
    (b) => b.symbol === symbol || b.instrument === symbol || (symbol === "CC" && b.instrument === "Amulet"),
  );
  return match ? match.available : null;
}

/** Compact trading balances for Create Intent / Solver desk. */
export function TradingBalancesStrip({
  appParty,
  highlightSymbol,
  balances: balancesProp,
  loading: loadingProp,
  error: errorProp,
  onRefresh,
}: {
  appParty: string | null;
  /** Optional token to emphasize (e.g. sell asset or fill asset). */
  highlightSymbol?: string;
  /** Pass from useTradingBalances to avoid a second fetch. */
  balances?: BalanceView[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}) {
  const local = useTradingBalances(balancesProp ? false : appParty);
  const balances = balancesProp ?? local.balances;
  const loading = loadingProp ?? local.loading;
  const error = errorProp ?? local.error;
  const refresh = onRefresh ?? local.refresh;

  if (!appParty && balances.length === 0 && !loading) {
    return (
      <div className="balance-strip balance-strip-empty">
        <span className="balance-strip-label">Trading balances</span>
        <span className="balance-strip-hint">Activate account to see balances</span>
      </div>
    );
  }

  const rows = displayRows(balances);

  return (
    <div className="balance-strip">
      <div className="balance-strip-head">
        <span className="balance-strip-label">Trading balances</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      {error && <p className="balance-strip-error">{error}</p>}
      <div className="balance-strip-grid">
        {rows.map((b) => {
          const active =
            highlightSymbol != null &&
            (b.symbol === highlightSymbol ||
              b.instrument === highlightSymbol ||
              (highlightSymbol === "CC" && b.instrument === "Amulet"));
          return (
            <div
              key={b.symbol}
              className={`balance-strip-chip${active ? " balance-strip-chip-active" : ""}`}
            >
              <span className="balance-strip-symbol">{b.symbol}</span>
              <span className="balance-strip-avail">
                {loading && !balances.length ? "…" : formatBalanceAmount(b.available, b.symbol)}
              </span>
              <span className="balance-strip-meta">
                {formatBalanceAmount(b.locked, b.symbol)} locked
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
