"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  cancelIntent,
  fetchQuote,
  fetchWalletProfile,
  onboardAccount,
  partyHeaders,
  type QuoteView,
} from "../../lib/api";
import { formatAmount } from "../../lib/format-amount";
import { isValidAmount } from "../../lib/amount";
import { isDemoMode } from "../../lib/demo-mode";
import { useWallet } from "../../lib/wallet/WalletProvider";
import type { PairId } from "../../lib/signing";
import { PartyAccessBanner } from "../../components/AccessGate";
import { DeadlineLabel } from "../../components/ClientTime";
import { LoopWalletBanner } from "../../components/WalletConnect";
import { IntentProgress, StatusBadge } from "../../components/StatusBadge";
import {
  TradingBalancesStrip,
  availableForSymbol,
  useTradingBalances,
} from "../../components/TradingBalances";

interface PairInfo {
  id: PairId;
  sell: string;
  buy: string;
  minSell: string;
  minBuy: string;
  maxTtlSeconds: number;
}

interface IntentView {
  intentId: string;
  makerParty: string;
  pair: PairId;
  sellAmount: string;
  minBuyAmount: string;
  status: string;
  deadline: string;
}

const TOKEN_COLORS: Record<string, string> = {
  CBTC: "#f7931a",
  USDCX: "#2775ca",
  USDCx: "#2775ca",
  CC: "#6366f1",
};

/** Preset TTLs offered in the UI (seconds), filtered by the pair's max. */
const TTL_PRESETS_SECONDS = [
  60, // 1 minute
  5 * 60, // 5 minutes
  15 * 60, // 15 minutes
  30 * 60, // 30 minutes
  60 * 60, // 1 hour
  6 * 60 * 60, // 6 hours
  12 * 60 * 60, // 12 hours
  24 * 60 * 60, // 1 day
] as const;

function ttlLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = seconds / 60;
    return mins === 1 ? "1 minute" : `${mins} minutes`;
  }
  if (seconds < 86400) {
    const hours = seconds / 3600;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const days = seconds / 86400;
  return days === 1 ? "1 day" : `${days} days`;
}

function ttlOptionsForMax(maxSeconds: number): number[] {
  const opts = TTL_PRESETS_SECONDS.filter((s) => s <= maxSeconds);
  // Always include the configured max if it isn't already a preset.
  if (maxSeconds > 0 && !opts.includes(maxSeconds)) opts.push(maxSeconds);
  return opts.length > 0 ? opts : [Math.max(60, maxSeconds)];
}

function TokenChip({ symbol }: { symbol: string }) {
  const color = TOKEN_COLORS[symbol] ?? "#94a3b8";
  return (
    <span className="token-chip">
      <span className="token-chip-dot" style={{ background: color }} />
      {symbol}
    </span>
  );
}

export default function HomePage() {
  const { data: session } = useSession();
  const { kind: walletKind, wallet, signIntent } = useWallet();
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [appParty, setAppParty] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  // X-7: mirror the authoritative backend freeze so we disable the action in the
  // UI too (the server still rejects a frozen account's intents regardless).
  const [accountFrozen, setAccountFrozen] = useState(false);
  const [pair, setPair] = useState<PairId>("CBTC_USDCX");
  const [sellAmount, setSellAmount] = useState("0.01");
  const [minBuyAmount, setMinBuyAmount] = useState("10");
  /** Intent open window; default 5m. Clamped to pair.maxTtlSeconds on submit. */
  const [ttlSeconds, setTtlSeconds] = useState(300);
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [intents, setIntents] = useState<IntentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const {
    balances,
    loading: balancesLoading,
    error: balancesError,
    refresh: refreshBalances,
  } = useTradingBalances(appParty);

  // Maker is the user's app (trading) party hosted on our validator, resolved
  // from the verified profile. Falls back to the linked Loop / session party.
  useEffect(() => {
    const email = session?.user.email;
    if (!email) return;
    let cancelled = false;
    void fetchWalletProfile(email)
      .then((profile) => {
        if (cancelled) return;
        setAccountFrozen(
          profile.accountStatus != null && profile.accountStatus !== "ACTIVE",
        );
        if (profile.appPartyId) {
          setAppParty(profile.appPartyId);
          setAccountNotice(null);
        } else {
          // Never show Loop/canton party here — trading party is only the
          // validator-hosted app party after Activate.
          setAppParty(null);
          setAccountNotice(
            "No trading account yet — activate one on the Account page to start trading.",
          );
        }
      })
      .catch(() => {
        if (!cancelled) setAppParty(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.email]);

  const selectedPair = pairs.find((p) => p.id === pair);
  const ttlOptions = selectedPair
    ? ttlOptionsForMax(selectedPair.maxTtlSeconds)
    : [...TTL_PRESETS_SECONDS];

  // Keep the selected TTL inside the pair's allowed max when pairs load / change.
  useEffect(() => {
    if (!selectedPair) return;
    if (ttlSeconds > selectedPair.maxTtlSeconds) {
      const opts = ttlOptionsForMax(selectedPair.maxTtlSeconds);
      setTtlSeconds(opts.includes(300) ? 300 : opts[opts.length - 1]!);
    }
  }, [selectedPair, ttlSeconds]);

  const refreshIntents = useCallback(async () => {
    // The backend lists intents for the authenticated app party; querying with
    // the demo/placeholder maker returns nothing (or errors). Only fetch once
    // the real trading party is resolved.
    if (!appParty) {
      setIntents([]);
      return;
    }
    setRefreshing(true);
    try {
      const res = await api<{ intents: IntentView[] }>(
        `/v1/intents?maker=${encodeURIComponent(appParty)}`,
      );
      setIntents(res.intents);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load your intents",
      });
    } finally {
      setRefreshing(false);
    }
  }, [appParty]);

  useEffect(() => {
    api<{ pairs: PairInfo[] }>("/v1/pairs")
      .then((r) => {
        setPairs(r.pairs);
        // Keep the selected pair valid: a controlled <select> whose value is not
        // among its options renders the first option but keeps the stale state,
        // so the user would submit a pair the backend doesn't know (500). If the
        // current pair isn't offered, snap to the first available one.
        if (r.pairs.length > 0 && !r.pairs.some((p) => p.id === pair)) {
          setPair(r.pairs[0].id as PairId);
        }
      })
      .catch(() =>
        setMessage({
          type: "error",
          text: "Could not load pairs. Start the API with `pnpm all` in intent-swap.",
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelIntentHandler = useCallback(
    async (intentId: string) => {
      if (!appParty) return;
      setCancellingId(intentId);
      setMessage(null);
      try {
        await cancelIntent(appParty, intentId);
        setMessage({ type: "success", text: "Intent cancelled — locked funds returned." });
        await Promise.all([refreshIntents(), refreshBalances()]);
      } catch (err) {
        setMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Failed to cancel intent",
        });
      } finally {
        setCancellingId(null);
      }
    },
    [appParty, refreshIntents, refreshBalances],
  );

  useEffect(() => {
    void refreshIntents();
  }, [refreshIntents]);

  useEffect(() => {
    if (!selectedPair) return;
    setMinBuyAmount(selectedPair.minBuy);
  }, [pair, selectedPair]);

  // Live quote: fetch an indicative price and use its `minReceive` as the
  // signed intent's minBuyAmount (v1 firm quote). Debounced on amount/pair.
  useEffect(() => {
    if (!selectedPair) {
      setQuoteLoading(false);
      return;
    }
    const amt = Number(sellAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setQuote(null);
      setQuoteError(null);
      setQuoteLoading(false);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    const handle = setTimeout(() => {
      fetchQuote(pair, sellAmount)
        .then((q) => {
          if (cancelled) return;
          setQuote(q);
          setQuoteError(null);
          setMinBuyAmount(q.minReceive);
        })
        .catch((err) => {
          if (cancelled) return;
          setQuote(null);
          setQuoteError(err instanceof Error ? err.message : "Quote unavailable");
        })
        .finally(() => {
          if (!cancelled) setQuoteLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [pair, sellAmount, selectedPair]);

  async function submitIntent() {
    setMessage(null);
    if (!appParty) {
      setMessage({
        type: "error",
        text: "Activate a trading account on the Account page before submitting intents.",
      });
      return;
    }
    if (!isValidAmount(sellAmount)) {
      setMessage({ type: "error", text: "Enter a valid sell amount (a positive number)." });
      return;
    }
    if (!isValidAmount(minBuyAmount)) {
      setMessage({
        type: "error",
        text: "Enter a valid minimum received amount (a positive number).",
      });
      return;
    }
    // Don't sign against a stale/in-flight quote: the live quote updates
    // minBuyAmount, so submitting mid-refresh could sign terms that don't match
    // the price shown.
    if (quoteLoading) {
      setMessage({ type: "error", text: "Hold on — fetching the latest price. Try again in a moment." });
      return;
    }
    if (quote && !quote.withinLimits) {
      setMessage({
        type: "error",
        text: `Trade size ($${quote.notionalUsd}) must be between $${quote.minNotionalUsd} and $${quote.maxNotionalUsd}.`,
      });
      return;
    }
    const maxTtl = selectedPair?.maxTtlSeconds ?? 86400;
    const effectiveTtl = Math.min(Math.max(60, ttlSeconds), maxTtl);
    setLoading(true);
    try {
      const intentId = crypto.randomUUID();
      const deadline = new Date(Date.now() + effectiveTtl * 1000).toISOString();
      const payload = {
        domain: "intent-swap/v1" as const,
        intentId,
        maker: appParty,
        pair,
        sellAmount,
        minBuyAmount,
        deadline,
        nonce: Date.now(),
      };
      const signature = await signIntent(payload);

      await api("/v1/intents", {
        method: "POST",
        headers: partyHeaders(appParty),
        body: JSON.stringify({ ...payload, signature }),
      });
      setMessage({ type: "success", text: "Intent submitted — solvers are now quoting." });
      await Promise.all([refreshIntents(), refreshBalances()]);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to submit intent",
      });
    } finally {
      setLoading(false);
    }
  }

  const activateAccount = useCallback(async () => {
    const email = session?.user.email;
    if (!email) return;
    // Guard against double-submit (rapid clicks firing duplicate onboards).
    if (activating) return;
    setActivating(true);
    setMessage(null);
    try {
      const profile = await fetchWalletProfile(email).catch(() => null);
      const { account } = await onboardAccount(
        email,
        profile?.loopPartyId ?? profile?.cantonPartyId ?? undefined,
      );
      setAppParty(account.appPartyId);
      setAccountNotice(null);
      setMessage({
        type: "success",
        text: isDemoMode()
          ? "Trading account activated"
          : `Trading account activated · ${account.appPartyId}`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to activate account",
      });
    } finally {
      setActivating(false);
    }
  }, [session?.user.email, activating]);

  const visibleIntents = intents.filter((i) => i.status !== "FAILED");
  const activeIntents = visibleIntents.filter((i) =>
    ["SUBMITTED", "LOCK_PENDING", "LOCKED", "MATCHED", "SETTLING"].includes(i.status),
  );
  const sellAvailable = selectedPair
    ? availableForSymbol(balances, selectedPair.sell)
    : null;

  return (
    <>
      <section className="hero-premium">
        <div className="hero-premium-content">
          <span className="hero-eyebrow">Canton Network · Intent Protocol</span>
          <h1>
            Sign what you want,
            <br />
            <span className="hero-gradient">not how to get it</span>
          </h1>
          <p>
            Express swap outcomes with a single signature. Sell-side locked on-ledger, solvers
            compete via private RFQ, settlement is atomic DvP.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="hero-metric">
            <span className="hero-metric-value">{activeIntents.length}</span>
            <span className="hero-metric-label">Active intents</span>
          </div>
          <div className="hero-metric">
            <span className="hero-metric-value">{pairs.length || "—"}</span>
            <span className="hero-metric-label">Live pairs</span>
          </div>
          <div className="hero-metric">
            <span className="hero-metric-value">DvP</span>
            <span className="hero-metric-label">Settlement</span>
          </div>
        </div>
      </section>

      <LoopWalletBanner />

      <TradingBalancesStrip
        appParty={appParty}
        highlightSymbol={selectedPair?.sell}
        balances={balances}
        loading={balancesLoading}
        error={balancesError}
        onRefresh={() => void refreshBalances()}
      />

      <div className="grid-2 grid-2-premium">
        <section className="panel panel-glass panel-swap">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">New swap intent</h2>
              <p className="panel-subtitle">You sign once · protocol settles atomically</p>
            </div>
            {selectedPair && (
              <div className="pair-badge">
                <TokenChip symbol={selectedPair.sell} />
                <span className="pair-arrow">→</span>
                <TokenChip symbol={selectedPair.buy} />
              </div>
            )}
          </div>

          {!isDemoMode() && (
            <div className="field">
              <label htmlFor="maker">Your trading party (Helvex app party)</label>
              <input
                id="maker"
                value={appParty ?? ""}
                placeholder="Not activated — allocate via Activate now"
                spellCheck={false}
                className="input-mono"
                readOnly
              />
              {accountNotice && (
                <p className="field-hint">
                  {accountNotice}{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={activateAccount}
                    disabled={activating}
                  >
                    {activating ? "Activating…" : "Activate now"}
                  </button>
                </p>
              )}
              {walletKind === "loop" && !wallet?.partyId && (
                <p className="field-hint">Connect Wallet from the account menu to sign and fund deposits.</p>
              )}
            </div>
          )}

          {accountNotice && isDemoMode() && (
            <p className="field-hint">
              {accountNotice.replace(/·\s+\S+$/, "")}{" "}
              <button
                type="button"
                className="link-button"
                onClick={activateAccount}
                disabled={activating}
              >
                {activating ? "Activating…" : "Activate now"}
              </button>
            </p>
          )}

          {appParty && !isDemoMode() ? (
            <PartyAccessBanner partyId={appParty} roleLabel="Trading" />
          ) : null}

          <div className="field">
            <label htmlFor="pair">Trading pair</label>
            <select id="pair" value={pair} onChange={(e) => setPair(e.target.value as PairId)}>
              {pairs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sell} → {p.buy}
                </option>
              ))}
            </select>
          </div>

          <div className="swap-flow swap-flow-premium">
            <div className="swap-leg swap-leg-premium">
              <div className="swap-leg-head">
                <span className="swap-leg-label">You sell</span>
                {selectedPair && <TokenChip symbol={selectedPair.sell} />}
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                placeholder={selectedPair?.minSell ?? "0"}
                aria-label="Sell amount"
                className="swap-amount-input"
              />
              {selectedPair && (
                <p className="field-hint">
                  Minimum {selectedPair.minSell} {selectedPair.sell}
                  {sellAvailable != null && (
                    <>
                      {" "}
                      · Available {formatAmount(sellAvailable)} {selectedPair.sell}
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="swap-divider swap-divider-premium">
              <span className="swap-divider-icon">⇅</span>
            </div>

            <div className="swap-leg swap-leg-premium">
              <div className="swap-leg-head">
                <span className="swap-leg-label">Receive at least</span>
                {selectedPair && <TokenChip symbol={selectedPair.buy} />}
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={minBuyAmount}
                onChange={(e) => setMinBuyAmount(e.target.value)}
                placeholder={selectedPair?.minBuy ?? "0"}
                aria-label="Minimum buy amount"
                className="swap-amount-input"
              />
              {selectedPair && (
                <p className="field-hint">
                  Minimum {formatAmount(selectedPair.minBuy)} {selectedPair.buy}
                </p>
              )}
            </div>
          </div>

          {quote && selectedPair && (
            <>
              <div className="swap-summary-row">
                <span>Rate</span>
                <span className="swap-summary-value">
                  1 {selectedPair.sell} ≈ {formatAmount(quote.rate)} {selectedPair.buy}
                </span>
              </div>
              <div className="swap-summary-row">
                <span>Estimated receive</span>
                <span className="swap-summary-value">
                  {formatAmount(quote.estReceive)} {selectedPair.buy}
                </span>
              </div>
              <div className="swap-summary-row">
                <span>Minimum received</span>
                <span className="swap-summary-value">
                  {formatAmount(quote.minReceive)} {selectedPair.buy}
                </span>
              </div>
            </>
          )}
          <div className="swap-summary-row">
            <span>Protocol fee</span>
            <span className="swap-summary-value">
              {quote && quote.feeBps > 0 ? `${(quote.feeBps / 100).toFixed(2)}%` : "No fee"}
            </span>
          </div>
          {quoteLoading && <p className="field-hint">Fetching live price…</p>}
          {quote && !quoteLoading && (
            <p className="field-hint">
              Indicative price · refresh before signing (valid ~{quote.ttlSeconds}s).
            </p>
          )}
          {quote && (
            <p className={`field-hint${quote.withinLimits ? "" : " field-hint-error"}`}>
              Trade size ≈ ${quote.notionalUsd} · per-trade limit ${quote.minNotionalUsd}–$
              {quote.maxNotionalUsd}
              {quote.withinLimits ? "" : " — out of range"}
            </p>
          )}
          {quoteError && (
            <p className="field-hint">
              Live price unavailable — enter your minimum manually.
            </p>
          )}
          <p className="field-hint">
            Your “receive at least” amount is enforced on-ledger — settlement reverts if a solver
            can’t meet it.
          </p>

          <div className="field">
            <label htmlFor="ttl">Expires in</label>
            <select
              id="ttl"
              value={ttlSeconds}
              onChange={(e) => setTtlSeconds(Number(e.target.value))}
            >
              {ttlOptions.map((s) => (
                <option key={s} value={s}>
                  {ttlLabel(s)}
                </option>
              ))}
            </select>
            <p className="field-hint">
              How long solvers can fill this intent. Max{" "}
              {ttlLabel(selectedPair?.maxTtlSeconds ?? 86400)}. Unfilled intents auto-refund after
              expiry.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-glow"
            onClick={submitIntent}
            disabled={
              loading ||
              quoteLoading ||
              pairs.length === 0 ||
              accountFrozen ||
              (quote ? !quote.withinLimits : false)
            }
          >
            {loading ? (
              <>
                <span className="spinner" />
                Signing intent…
              </>
            ) : (
              "Submit signed intent"
            )}
          </button>

          {accountFrozen && (
            <div className="alert alert-error">
              Your account is not active — trading is paused. Contact support.
            </div>
          )}

          {message && (
            <div className={`alert alert-${message.type === "success" ? "success" : "error"}`}>
              {message.text}
            </div>
          )}
        </section>

        <section className="panel panel-glass">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Your intents</h2>
              <p className="panel-subtitle">
                {activeIntents.length} active · {visibleIntents.length} total
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={refreshIntents}
              disabled={refreshing}
            >
              {refreshing ? "…" : "Refresh"}
            </button>
          </div>

          {visibleIntents.length === 0 ? (
            <div className="empty-state empty-state-premium">
              <div className="empty-state-icon">◎</div>
              <p>No intents yet</p>
              <span className="empty-state-sub">Submit your first swap to start RFQ matching</span>
            </div>
          ) : (
            <div className="intent-list">
              {visibleIntents.map((intent) => {
                const [sell, buy] = intent.pair.split("_");
                const cancellable = ["SUBMITTED", "LOCK_PENDING", "LOCKED"].includes(
                  intent.status,
                );
                return (
                  <article key={intent.intentId} className="intent-card intent-card-premium">
                    <div className="intent-card-top">
                      <div>
                        <div className="intent-pair">
                          <TokenChip symbol={sell} />
                          <span className="pair-arrow-sm">→</span>
                          <TokenChip symbol={buy} />
                        </div>
                        <div className="intent-amounts">
                          Sell {formatAmount(intent.sellAmount)} · Min{" "}
                          {formatAmount(intent.minBuyAmount)}
                        </div>
                      </div>
                      <StatusBadge status={intent.status} />
                    </div>
                    <IntentProgress status={intent.status} />
                    <div className="intent-meta">
                      <DeadlineLabel iso={intent.deadline} />
                      <span className="intent-id" title={intent.intentId}>
                        {intent.intentId.slice(0, 8)}…{intent.intentId.slice(-4)}
                      </span>
                    </div>
                    {cancellable && (
                      <div className="intent-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => cancelIntentHandler(intent.intentId)}
                          disabled={cancellingId === intent.intentId}
                        >
                          {cancellingId === intent.intentId ? "Cancelling…" : "Cancel intent"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
