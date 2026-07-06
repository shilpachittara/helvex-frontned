"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  fetchQuote,
  fetchWalletProfile,
  onboardAccount,
  partyHeaders,
  type QuoteView,
} from "../../lib/api";
import { formatAmount } from "../../lib/format-amount";
import { isValidAmount } from "../../lib/amount";
import { useWallet } from "../../lib/wallet/WalletProvider";
import type { PairId } from "../../lib/signing";
import { PartyAccessBanner } from "../../components/AccessGate";
import { LoopWalletBanner } from "../../components/WalletConnect";
import { IntentProgress, StatusBadge } from "../../components/StatusBadge";

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

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (!Number.isFinite(diff)) return "—";
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
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
  const [maker, setMaker] = useState("maker::1220demo");
  const [appParty, setAppParty] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  // X-7: mirror the authoritative backend freeze so we disable the action in the
  // UI too (the server still rejects a frozen account's intents regardless).
  const [accountFrozen, setAccountFrozen] = useState(false);
  const [pair, setPair] = useState<PairId>("CBTC_USDCX");
  const [sellAmount, setSellAmount] = useState("0.01");
  const [minBuyAmount, setMinBuyAmount] = useState("10");
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [intents, setIntents] = useState<IntentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

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
          setMaker(profile.appPartyId);
          setAccountNotice(null);
        } else {
          setAccountNotice(
            "No trading account yet — activate one on the Account page to start trading.",
          );
          if (profile.cantonPartyId) setMaker(profile.cantonPartyId);
        }
      })
      .catch(() => {
        if (!cancelled && session?.user.cantonPartyId) setMaker(session.user.cantonPartyId);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.email, session?.user.cantonPartyId]);

  const selectedPair = pairs.find((p) => p.id === pair);

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
    setLoading(true);
    try {
      const intentId = crypto.randomUUID();
      const deadline = new Date(Date.now() + 5 * 60_000).toISOString();
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
      await refreshIntents();
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
      const { account } = await onboardAccount(email);
      setAppParty(account.appPartyId);
      setMaker(account.appPartyId);
      setAccountNotice(null);
      setMessage({ type: "success", text: "Trading account activated." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to activate account",
      });
    } finally {
      setActivating(false);
    }
  }, [session?.user.email, activating]);

  const activeIntents = intents.filter((i) =>
    ["SUBMITTED", "LOCK_PENDING", "LOCKED", "MATCHED", "SETTLING"].includes(i.status),
  );

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

      <div className="grid-2 grid-2-premium">
        <section className="panel panel-glass panel-swap">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">New swap intent</h2>
              <p className="panel-subtitle">Maker signs once · protocol settles atomically</p>
            </div>
            {selectedPair && (
              <div className="pair-badge">
                <TokenChip symbol={selectedPair.sell} />
                <span className="pair-arrow">→</span>
                <TokenChip symbol={selectedPair.buy} />
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="maker">Maker party ID (your trading account)</label>
            <input
              id="maker"
              value={maker}
              onChange={(e) => setMaker(e.target.value)}
              placeholder="appparty::1220..."
              spellCheck={false}
              className="input-mono"
              readOnly={Boolean(appParty)}
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
              <p className="field-hint">Connect Loop wallet to sign and fund deposits.</p>
            )}
          </div>

          <PartyAccessBanner partyId={maker} roleLabel="Maker" />

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
                {activeIntents.length} active · {intents.length} total
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

          {intents.length === 0 ? (
            <div className="empty-state empty-state-premium">
              <div className="empty-state-icon">◎</div>
              <p>No intents yet</p>
              <span className="empty-state-sub">Submit your first swap to start RFQ matching</span>
            </div>
          ) : (
            <div className="intent-list">
              {intents.map((intent) => {
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
                        <div className="intent-amounts">
                          Sell {formatAmount(intent.sellAmount)} · Min{" "}
                          {formatAmount(intent.minBuyAmount)}
                        </div>
                      </div>
                      <StatusBadge status={intent.status} />
                    </div>
                    <IntentProgress status={intent.status} />
                    <div className="intent-meta">
                      <span>{formatDeadline(intent.deadline)}</span>
                      <span className="intent-id" title={intent.intentId}>
                        {intent.intentId.slice(0, 8)}…{intent.intentId.slice(-4)}
                      </span>
                    </div>
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
