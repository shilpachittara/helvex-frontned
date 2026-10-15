"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fetchWalletProfile } from "../../../lib/api";
import { isDemoMode } from "../../../lib/demo-mode";
import { amountForTransfer, exceedsAvailable, normalizeAmount } from "../../../lib/amount";
import { unlockedForSymbol } from "../../../lib/loop-holdings";
import { useLoopHoldings } from "../../../lib/use-loop-holdings";
import { formatAmount } from "../../../lib/format-amount";
import type { PairId } from "@intent-swap/domain";
import { PartyAccessBanner } from "../../../components/AccessGate";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { DeadlineLabel } from "../../../components/ClientTime";
import { FundingSourcePicker, useFundingSource } from "../../../components/FundingSource";
import { StatusBadge } from "../../../components/StatusBadge";
import {
  TradingBalancesStrip,
  availableForSymbol,
  useTradingBalances,
} from "../../../components/TradingBalances";
import { fundFromLoop, type FundFromLoopProgress } from "../../../lib/fund-from-loop";
import { isLoopWalletEnabled } from "../../../lib/wallet/config";
import { useWallet } from "../../../lib/wallet/WalletProvider";

interface IntentView {
  intentId: string;
  pair: PairId;
  sellAmount: string;
  minBuyAmount: string;
  fillBuyAmount?: string | null;
  status: string;
  makerParty: string;
  winningSolver?: string | null;
  deadline?: string;
}

const HISTORY_STATUSES = new Set(["MATCHED", "SETTLING", "SETTLED", "FAILED"]);

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
  const { wallet, status: walletStatus, connect, transfer, readLoopHoldings } = useWallet();
  const [payFrom, setPayFrom] = useFundingSource();
  const payingFromLoop = isLoopWalletEnabled() && payFrom === "loop";
  const loopHoldings = useLoopHoldings(payingFromLoop && walletStatus === "connected");
  const [fundProgress, setFundProgress] = useState<FundFromLoopProgress | "filling" | null>(
    null,
  );
  const [intents, setIntents] = useState<IntentView[]>([]);
  const [fills, setFills] = useState<IntentView[]>([]);
  const [solverTab, setSolverTab] = useState<"queue" | "fills">("queue");
  const [solver, setSolver] = useState<string | null>(null);
  const [buyAmount, setBuyAmount] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFill, setPendingFill] = useState<IntentView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const {
    balances,
    loading: balancesLoading,
    error: balancesError,
    refresh: refreshBalances,
  } = useTradingBalances(Boolean(session?.user.email) || solver);

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
      const [queueRes, mineRes] = await Promise.all([
        api<{ intents: IntentView[] }>("/v1/solver/intents"),
        api<{ intents: IntentView[] }>("/v1/intents?role=solver"),
      ]);
      // Defense in depth: fill queue is LOCKED-only.
      setIntents((queueRes.intents ?? []).filter((i) => ACTIONABLE.has(i.status)));
      setFills((mineRes.intents ?? []).filter((i) => HISTORY_STATUSES.has(i.status)));
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

  function requestFill(intent: IntentView) {
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
    const useLoop = isLoopWalletEnabled() && payFrom === "loop";
    if (useLoop && walletStatus !== "connected") {
      setError("Connect Loop before paying from your wallet.");
      return;
    }
    if (!useLoop) {
      const buySymbol = intent.pair.split("_")[1] ?? "";
      const helvexAvailable = availableForSymbol(balances, buySymbol);
      if (helvexAvailable != null && exceedsAvailable(amount, helvexAvailable)) {
        setError(
          `Amount is above the Helvex balance of ${formatAmount(helvexAvailable)} ${buySymbol}.`,
        );
        return;
      }
    }
    setError(null);
    setPendingFill(intent);
  }

  async function fill(intent: IntentView) {
    setPendingFill(null);
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
    const useLoop = isLoopWalletEnabled() && payFrom === "loop";
    if (useLoop && walletStatus !== "connected") {
      setError("Connect Loop before paying from your wallet.");
      return;
    }
    if (!useLoop) {
      const buySymbol = intent.pair.split("_")[1] ?? "";
      const helvexAvailable = availableForSymbol(balances, buySymbol);
      if (helvexAvailable != null && exceedsAvailable(amount, helvexAvailable)) {
        setError(
          `Amount is above the Helvex balance of ${formatAmount(helvexAvailable)} ${buySymbol}.`,
        );
        return;
      }
    }
    setLoadingId(intent.intentId);
    setError(null);
    setNotice(null);
    try {
    const buy = intent.pair.split("_")[1] ?? "USDCX";
    const buyAmount = amountForTransfer(buy, normalizeAmount(amount));
    if (useLoop) {
      await fundFromLoop({
        appParty: solver,
        symbol: buy,
        amount: buyAmount,
        transfer,
        readHoldings: readLoopHoldings,
        onProgress: setFundProgress,
      });
      await refreshBalances();
    }
    setFundProgress("filling");
    await api("/v1/solver/fill", {
      method: "POST",
      body: JSON.stringify({
        intentId: intent.intentId,
        solver,
        buyAmount,
      }),
    });
      setIntents((prev) => prev.filter((i) => i.intentId !== intent.intentId));
      setNotice(`Fill accepted for ${intent.intentId.slice(0, 8)}… — it is now in Your fills.`);
      setSolverTab("fills");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fill failed");
    } finally {
      setLoadingId(null);
      setFundProgress(null);
      setPendingFill(null);
    }
  }

  return (
    <div className="rfq-desk">
      <section className="hero-premium hero-compact">
        <div className="hero-premium-content">
          <span className="hero-eyebrow">Solver · fill &amp; history</span>
          <h1>
            Fill locked intents
            <span className="hero-gradient"> atomically</span>
          </h1>
          <p>
            Pay the buy leg from your Helvex balance or from Loop. After you accept, the RFQ moves
            to <strong>Your fills</strong> and to activity on Create intent.
          </p>
        </div>
      </section>

      <div className="solver-stats solver-stats-premium">
        <div className="stat-card stat-card-premium">
          <div className="stat-value">{openQueue.length}</div>
          <div className="stat-label">Open to fill</div>
        </div>
        <div className="stat-card stat-card-premium">
          <div className="stat-value">{fills.filter((i) => i.status === "SETTLED").length}</div>
          <div className="stat-label">Your settled fills</div>
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
            <h2 className="panel-title">{solverTab === "queue" ? "Fill queue" : "Your fills"}</h2>
            <p className="panel-subtitle">
              {solverTab === "queue"
                ? "Actionable locks only · accepted fills move to Your fills"
                : "RFQs you filled · also listed on Create intent activity"}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="intent-tabs" role="tablist" aria-label="Solver lists">
          <button
            type="button"
            role="tab"
            aria-selected={solverTab === "queue"}
            className={`intent-tab${solverTab === "queue" ? " active" : ""}`}
            onClick={() => setSolverTab("queue")}
          >
            Open to fill ({openQueue.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={solverTab === "fills"}
            className={`intent-tab${solverTab === "fills" ? " active" : ""}`}
            onClick={() => setSolverTab("fills")}
          >
            Your fills ({fills.length})
          </button>
        </div>

        {solverTab === "queue" && (
          <FundingSourcePicker
            value={payFrom}
            onChange={setPayFrom}
            purpose="fill"
            loopConnected={walletStatus === "connected"}
            loopParty={wallet?.partyId}
            connecting={walletStatus === "connecting"}
            onConnect={() => void connect()}
          />
        )}

        {error && <div className="alert alert-error">{error}</div>}
        {payingFromLoop && loopHoldings.error && (
          <div className="alert alert-error">{loopHoldings.error}</div>
        )}
        {notice && <div className="alert alert-success">{notice}</div>}

        {solverTab === "fills" ? (
          fills.length === 0 && !refreshing ? (
            <div className="empty-state empty-state-premium">
              <div className="empty-state-icon">◎</div>
              <p>No fills yet</p>
              <span className="empty-state-sub">
                Accept a LOCKED RFQ from the queue — it stays here through settle
              </span>
            </div>
          ) : (
            <div className="intent-list intent-list-grid">
              {fills.map((intent) => {
                const [sell, buy] = intent.pair.split("_");
                return (
                  <article key={intent.intentId} className="intent-card intent-card-premium">
                    <div className="intent-card-top">
                      <div>
                        <div className="intent-pair">
                          <TokenChip symbol={sell} />
                          <span className="pair-arrow-sm">→</span>
                          <TokenChip symbol={buy} />
                        </div>
                        <p className="intent-amounts">
                          You paid {formatAmount(intent.fillBuyAmount ?? intent.minBuyAmount)} {buy}{" "}
                          · received {formatAmount(intent.sellAmount)} {sell}
                        </p>
                      </div>
                      <StatusBadge status={intent.status} />
                    </div>
                    <p className="solver-maker">
                      Maker {intent.makerParty.slice(0, 16)}… · {intent.intentId.slice(0, 8)}…
                    </p>
                    <p className="solver-maker">
                      <Link href="/" className="link-button">
                        Open in activity
                      </Link>
                    </p>
                  </article>
                );
              })}
            </div>
          )
        ) : openQueue.length === 0 && !refreshing ? (
          <div className="empty-state empty-state-premium">
            <div className="empty-state-icon">✓</div>
            <p>Queue is clear</p>
            <span className="empty-state-sub">
              No LOCKED RFQs — your accepted fills are under Your fills
            </span>
          </div>
        ) : (
          <div className="solver-queue">
            {openQueue.map((intent) => {
              const [sell, buy] = intent.pair.split("_");
              const buyAvail = availableForSymbol(balances, buy);
              const typedFill = buyAmount[intent.intentId] ?? formatAmount(intent.minBuyAmount);
              const loopUnlocked = loopHoldings.holdings
                ? unlockedForSymbol(loopHoldings.holdings, buy)
                : null;
              const overLoop =
                payingFromLoop && loopUnlocked != null && exceedsAvailable(typedFill, loopUnlocked);
              const overHelvex =
                !payingFromLoop && buyAvail != null && exceedsAvailable(typedFill, buyAvail);
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
                      {intent.deadline ? (
                        <>
                          <span className="solver-card-sep">·</span>
                          <DeadlineLabel iso={intent.deadline} />
                        </>
                      ) : null}
                    </p>
                    {payingFromLoop ? (
                      <p className="solver-maker">
                        Loop available:{" "}
                        <strong>
                          {loopUnlocked == null ? "…" : formatAmount(loopUnlocked)} {buy}
                        </strong>
                      </p>
                    ) : (
                      buyAvail != null && (
                        <p className="solver-maker">
                          Helvex available: <strong>{formatAmount(buyAvail)} {buy}</strong>
                        </p>
                      )
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
                      onClick={() => requestFill(intent)}
                      disabled={
                        loadingId === intent.intentId ||
                        !solver ||
                        (payFrom === "loop" &&
                          isLoopWalletEnabled() &&
                          walletStatus !== "connected") ||
                        (payingFromLoop &&
                          walletStatus === "connected" &&
                          (loopHoldings.loading ||
                            Boolean(loopHoldings.error) ||
                            overLoop ||
                            loopUnlocked == null)) ||
                        overHelvex
                      }
                    >
                      {loadingId === intent.intentId ? (
                        <>
                          <span className="spinner" />
                          {fundProgress === "preparing"
                            ? " Preparing…"
                            : fundProgress === "awaiting_loop"
                              ? " Waiting for Loop…"
                              : fundProgress === "crediting"
                                ? " Crediting…"
                                : " Filling…"}
                        </>
                      ) : payFrom === "loop" && isLoopWalletEnabled() ? (
                        "Approve in Loop and fill"
                      ) : (
                        "Accept fill"
                      )}
                    </button>
                    {overLoop && loopUnlocked != null && (
                      <p className="solver-maker">
                        Amount is above the Loop balance of {formatAmount(loopUnlocked)} {buy}.
                      </p>
                    )}
                    {overHelvex && buyAvail != null && (
                      <p className="solver-maker">
                        Amount is above the Helvex balance of {formatAmount(buyAvail)} {buy}.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <ConfirmDialog
        open={pendingFill != null}
        titleId="fill-confirm-title"
        title="Confirm fill"
        confirmLabel="Fill RFQ"
        busy={pendingFill != null && loadingId === pendingFill.intentId}
        onClose={() => {
          if (!loadingId) setPendingFill(null);
        }}
        onConfirm={() => {
          if (pendingFill) void fill(pendingFill);
        }}
      >
        <p>Confirm that you want to fill this RFQ.</p>
        <p>
          Once confirmed,{" "}
          <strong>
            {pendingFill
              ? `${formatAmount(
                  /^\d+(\.\d+)?$/.test(buyAmount[pendingFill.intentId]?.trim() ?? "")
                    ? buyAmount[pendingFill.intentId]!.trim()
                    : pendingFill.minBuyAmount,
                )} ${pendingFill.pair.split("_")[1] ?? ""}`
              : ""}
          </strong>{" "}
          will be paid to settle this trade. You will receive the maker&apos;s locked{" "}
          {pendingFill ? pendingFill.pair.split("_")[0] : "tokens"}. This fill cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
