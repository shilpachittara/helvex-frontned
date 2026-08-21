"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fetchWalletProfile } from "../../../lib/api";
import { isDemoMode } from "../../../lib/demo-mode";
import { normalizeAmount } from "../../../lib/amount";
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
  deadline?: string;
}

const TOKEN_COLORS: Record<string, string> = {
  CBTC: "#f7931a",
  USDCX: "#2775ca",
  USDCx: "#2775ca",
  CC: "#6366f1",
};

/** Solver fill queue is actionable locks only — never settled/history. */
const ACTIONABLE = new Set(["LOCKED"]);

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
  const [solver, setSolver] = useState<string | null>(null);
  const [buyAmount, setBuyAmount] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
        /* no trading account yet */
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
      // Defense in depth: API is LOCKED-only; never show resolved RFQs here.
      setIntents((res.intents ?? []).filter((i) => ACTIONABLE.has(i.status)));
      await refreshBalances();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load intents");
    } finally {
      setRefreshing(false);
    }
  }, [refreshBalances]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openQueue = useMemo(
    () => intents.filter((i) => ACTIONABLE.has(i.status)),
    [intents],
  );

  async function fill(intent: IntentView) {
    if (!solver) {
      setError("Activate your trading account before filling intents.");
      return;
    }
    const raw = buyAmount[intent.intentId]?.trim();
    let amount: string;
    if (!raw) {
      amount = intent.minBuyAmount;
    } else if (/^\d+(\.\d+)?$/.test(raw)) {
      amount = raw;
    } else {
      setError("Enter a valid fill amount (a positive number), or leave blank for the minimum.");
      return;
    }
    if (Number.parseFloat(amount) <= 0) {
      setError("Fill amount must be greater than zero.");
      return;
    }
    setLoadingId(intent.intentId);
    setError(null);
    setNotice(null);
    try {
      await api("/v1/solver/fill", {
        method: "POST",
        body: JSON.stringify({
          intentId: intent.intentId,
          solver,
          buyAmount: normalizeAmount(amount),
        }),
      });
      // Drop from queue immediately — creator tracks SETTLED on their desk.
      setIntents((prev) => prev.filter((i) => i.intentId !== intent.intentId));
      setNotice(
        `Fill accepted for ${intent.intentId.slice(0, 8)}… — removed from your queue. The user sees status on Create intent.`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fill failed");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="rfq-desk">
      <section className="hero-premium hero-compact">
        <div className="hero-premium-content">
          <span className="hero-eyebrow">Solver · open RFQs only</span>
          <h1>
            Fill locked intents
            <span className="hero-gradient"> atomically</span>
          </h1>
          <p>
            Queue shows <strong>LOCKED</strong> RFQs you can fill. Once filled, the RFQ leaves this
            desk — the creator tracks MATCHED → SETTLED on their intent book.
          </p>
        </div>
      </section>

      <div className="solver-stats solver-stats-premium">
        <div className="stat-card stat-card-premium">
          <div className="stat-value">{openQueue.length}</div>
          <div className="stat-label">Open to fill</div>
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
          <div className="stat-value">1st</div>
          <div className="stat-label">Valid fill wins</div>
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
            <p className="panel-subtitle">
              Actionable locks only · settled RFQs are not listed here
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh queue"}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}

        {openQueue.length === 0 && !refreshing ? (
          <div className="empty-state empty-state-premium">
            <div className="empty-state-icon">✓</div>
            <p>Queue is clear</p>
            <span className="empty-state-sub">
              No LOCKED RFQs — filled and settled intents stay on the user&apos;s Create desk
            </span>
          </div>
        ) : (
          <div className="solver-queue">
            {openQueue.map((intent) => {
              const [sell, buy] = intent.pair.split("_");
              const buyAvail = availableForSymbol(balances, buy);
              return (
                <article key={intent.intentId} className="solver-card">
                  <div className="solver-card-main">
                    <div className="solver-card-top">
                      <div className="intent-pair">
                        <TokenChip symbol={sell} />
                        <span className="pair-arrow-sm">→</span>
                        <TokenChip symbol={buy} />
                      </div>
                      <StatusBadge status={intent.status} />
                    </div>
                    <p className="solver-card-size">
                      Sell <strong>{formatAmount(intent.sellAmount)}</strong> {sell}
                      <span className="solver-card-sep">·</span>
                      Min buy <strong>{formatAmount(intent.minBuyAmount)}</strong> {buy}
                    </p>
                    <p className="solver-maker">
                      {isDemoMode()
                        ? "User RFQ"
                        : `Maker ${intent.makerParty.slice(0, 22)}…`}
                      <span className="solver-card-sep">·</span>
                      {intent.intentId.slice(0, 8)}…
                    </p>
                    {buyAvail != null && (
                      <p className="solver-maker">
                        Your {buy} available: <strong>{formatAmount(buyAvail)}</strong>
                      </p>
                    )}
                  </div>

                  <div className="solver-card-action">
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
                    <button
                      type="button"
                      className="btn btn-primary btn-sm btn-glow"
                      onClick={() => void fill(intent)}
                      disabled={loadingId === intent.intentId || !solver}
                    >
                      {loadingId === intent.intentId ? (
                        <span className="spinner" />
                      ) : (
                        "Accept fill"
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
