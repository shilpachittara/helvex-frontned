"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { api, fetchWalletProfile } from "../../../lib/api";
import { isDemoMode } from "../../../lib/demo-mode";
import { formatAmount } from "../../../lib/format-amount";
import type { PairId } from "@intent-swap/domain";
import { PartyAccessBanner } from "../../../components/AccessGate";
import { StatusBadge } from "../../../components/StatusBadge";
import {
  TradingBalancesStrip,
  availableForSymbol,
  useTradingBalances,
} from "../../../components/TradingBalances";

interface IntentView {
  intentId: string;
  pair: PairId;
  sellAmount: string;
  minBuyAmount: string;
  status: string;
  makerParty: string;
}

const TOKEN_COLORS: Record<string, string> = {
  CBTC: "#f7931a",
  USDCX: "#2775ca",
  USDCx: "#2775ca",
  CC: "#6366f1",
};

function TokenChip({ symbol }: { symbol: string }) {
  const color = TOKEN_COLORS[symbol] ?? "#94a3b8";
  return (
    <span className="token-chip">
      <span className="token-chip-dot" style={{ background: color }} />
      {symbol}
    </span>
  );
}

export default function SolverPage() {
  const { data: session } = useSession();
  const [intents, setIntents] = useState<IntentView[]>([]);
  // The solver identity the backend authorizes against is the trading (app)
  // party from onboarding — NOT the Loop/canton party on the session. Resolve
  // it from the wallet profile; fills stay disabled until it loads.
  const [solver, setSolver] = useState<string | null>(null);
  const [buyAmount, setBuyAmount] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    balances,
    loading: balancesLoading,
    error: balancesError,
    refresh: refreshBalances,
  } = useTradingBalances(solver);

  useEffect(() => {
    const email = session?.user.email;
    if (!email) return;
    let cancelled = false;
    fetchWalletProfile(email)
      .then((p) => {
        if (!cancelled) setSolver(p.appPartyId);
      })
      .catch(() => {
        /* no trading account yet — solver stays null, fills disabled */
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.email]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await api<{ intents: IntentView[] }>("/v1/solver/intents");
      setIntents(res.intents);
      await refreshBalances();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load intents");
    } finally {
      setRefreshing(false);
    }
  }, [refreshBalances]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function fill(intent: IntentView) {
    if (!solver) {
      setError("Activate your trading account before filling intents.");
      return;
    }
    // Empty/whitespace input intentionally fills at the minimum. But a non-empty
    // yet invalid value must be REJECTED, not silently coerced to the minimum
    // (otherwise the solver fills at a price they didn't intend).
    const raw = buyAmount[intent.intentId]?.trim();
    let amount: string;
    if (!raw) {
      amount = intent.minBuyAmount;
    } else if (/^\d+(\.\d+)?$/.test(raw)) {
      amount = raw;
    } else {
      setError("Enter a valid fill amount (a positive number), or leave it blank to fill at the minimum.");
      return;
    }
    if (Number.parseFloat(amount) <= 0) {
      setError("Fill amount must be greater than zero.");
      return;
    }
    setLoadingId(intent.intentId);
    setError(null);
    try {
      await api("/v1/solver/fill", {
        method: "POST",
        body: JSON.stringify({
          intentId: intent.intentId,
          solver,
          buyAmount: amount,
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fill failed");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <section className="hero-premium hero-compact">
        <div className="hero-premium-content">
          <span className="hero-eyebrow">Solver · RFQ Desk</span>
          <h1>
            Fill open intents
            <span className="hero-gradient"> atomically</span>
          </h1>
          <p>
            Review open swap intents and submit competitive fills. Buy-side liquidity locks on
            settlement — first valid fill wins.
          </p>
        </div>
      </section>

      <div className="solver-stats solver-stats-premium">
        <div className="stat-card stat-card-premium">
          <div className="stat-value">{intents.length}</div>
          <div className="stat-label">Open intents</div>
        </div>
        {!isDemoMode() && (
          <div className="stat-card stat-card-premium">
            <div className="stat-value stat-value-mono">
              {solver ? `${solver.slice(0, 14)}…` : "—"}
            </div>
            <div className="stat-label">Your trading party</div>
          </div>
        )}
        <div className="stat-card stat-card-premium">
          <div className="stat-value">RFQ</div>
          <div className="stat-label">Matching mode</div>
        </div>
      </div>

      <TradingBalancesStrip
        appParty={solver}
        balances={balances}
        loading={balancesLoading}
        error={balancesError}
        onRefresh={() => void refreshBalances()}
      />

      {solver && !isDemoMode() && <PartyAccessBanner partyId={solver} roleLabel="Trading" />}

      <section className="panel panel-glass">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Fill queue</h2>
            <p className="panel-subtitle">First-fill wins · min buy enforced on-chain</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={refresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh queue"}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {intents.length === 0 && !refreshing ? (
          <div className="empty-state empty-state-premium">
            <div className="empty-state-icon">✓</div>
            <p>Queue is clear</p>
            <span className="empty-state-sub">No open intents — check back when users submit</span>
          </div>
        ) : (
          <div className="solver-queue">
            {intents.map((intent) => {
              const [sell, buy] = intent.pair.split("_");
              const buyAvail = availableForSymbol(balances, buy);
              return (
                <div key={intent.intentId} className="solver-row solver-row-premium">
                  <div className="solver-row-info">
                    <div className="intent-pair">
                      <TokenChip symbol={sell} />
                      <span className="pair-arrow-sm">→</span>
                      <TokenChip symbol={buy} />
                    </div>
                    <span>
                      Sell <strong>{formatAmount(intent.sellAmount)}</strong> · Min buy{" "}
                      <strong>{formatAmount(intent.minBuyAmount)}</strong>
                    </span>
                    <span className="solver-maker">
                      {isDemoMode()
                        ? "User intent"
                        : `User ${intent.makerParty.slice(0, 22)}…`}
                    </span>
                    {buyAvail != null && (
                      <span className="solver-maker">
                        Your {buy} available: <strong>{formatAmount(buyAvail)}</strong>
                      </span>
                    )}
                  </div>

                  <div className="solver-fill-group">
                    <label className="section-label" htmlFor={`fill-${intent.intentId}`}>
                      Your fill ({buy})
                    </label>
                    <input
                      id={`fill-${intent.intentId}`}
                      className="solver-fill-input"
                      type="text"
                      inputMode="decimal"
                      value={buyAmount[intent.intentId] ?? formatAmount(intent.minBuyAmount)}
                      onChange={(e) =>
                        setBuyAmount((prev) => ({ ...prev, [intent.intentId]: e.target.value }))
                      }
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm btn-glow"
                    onClick={() => fill(intent)}
                    disabled={loadingId === intent.intentId || !solver}
                  >
                    {loadingId === intent.intentId ? (
                      <span className="spinner" />
                    ) : (
                      "Accept fill"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
