"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBalances, type BalanceView } from "../lib/api";
import { formatAmount } from "../lib/format-amount";

export function useTradingBalances(appParty: string | null) {
  const [balances, setBalances] = useState<BalanceView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!appParty) {
      setBalances([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchBalances(appParty);
      setBalances(res.balances);
    } catch (err) {
      setBalances([]);
      setError(err instanceof Error ? err.message : "Failed to load balances");
    } finally {
      setLoading(false);
    }
  }, [appParty]);

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
  const local = useTradingBalances(balancesProp ? null : appParty);
  const balances = balancesProp ?? local.balances;
  const loading = loadingProp ?? local.loading;
  const error = errorProp ?? local.error;
  const refresh = onRefresh ?? local.refresh;

  if (!appParty) {
    return (
      <div className="balance-strip balance-strip-empty">
        <span className="balance-strip-label">Trading balances</span>
        <span className="balance-strip-hint">Activate account to see balances</span>
      </div>
    );
  }

  const visible = balances.filter((b) => parseFloat(b.total) > 0 || parseFloat(b.available) > 0);
  const rows = visible.length > 0 ? visible : balances;

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
      {!error && (
        <div className="balance-strip-grid">
          {rows.map((b) => {
            const active =
              highlightSymbol != null &&
              (b.symbol === highlightSymbol ||
                b.instrument === highlightSymbol ||
                (highlightSymbol === "CC" && b.instrument === "Amulet"));
            return (
              <div
                key={b.instrument}
                className={`balance-strip-chip${active ? " balance-strip-chip-active" : ""}`}
              >
                <span className="balance-strip-symbol">{b.symbol}</span>
                <span className="balance-strip-avail">{formatAmount(b.available)}</span>
                <span className="balance-strip-meta">
                  {formatAmount(b.locked)} locked
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
