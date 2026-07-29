"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import {
  acceptPendingDeposits,
  createApiKey,
  fetchBalances,
  fetchWalletProfile,
  listApiKeys,
  listDeposits,
  listPendingDeposits,
  listTransfers,
  listWithdrawals,
  onboardAccount,
  prepareDeposit,
  requestWithdrawal,
  revokeApiKey,
  sendTransfer,
  type ApiKeyScope,
  type ApiKeyView,
  type BalanceView,
  type DepositView,
  type Instrument,
  type PendingInboundDeposit,
  type TransferView,
  type WalletProfile,
  type WithdrawalView,
} from "../../../lib/api";
import { isValidAmount } from "../../../lib/amount";
import { isDemoMode } from "../../../lib/demo-mode";
import { formatAmount } from "../../../lib/format-amount";
import { formatUtcDate, formatUtcDateTime } from "../../../lib/format-time";
import { useWallet } from "../../../lib/wallet/WalletProvider";

const INSTRUMENTS: Instrument[] = ["CC", "CBTC", "USDCX"];
const SCOPES: ApiKeyScope[] = ["read", "maker", "solver", "withdraw", "transfer"];

function newIdempotencyKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Compact party id for UI footers (full value stays in title/tooltip). */
function shortPartyId(partyId: string): string {
  const parts = partyId.split("::");
  if (parts.length !== 2) {
    return partyId.length > 28 ? `${partyId.slice(0, 12)}…${partyId.slice(-8)}` : partyId;
  }
  const hint = parts[0].length > 12 ? `${parts[0].slice(0, 10)}…` : parts[0];
  return `${hint}::${parts[1].slice(0, 8)}…`;
}

type Notice = { type: "success" | "error"; text: string } | null;

export default function AccountPage() {
  const { data: session } = useSession();
  const { transfer, kind: walletKind, wallet } = useWallet();
  const email = session?.user.email ?? null;

  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [appParty, setAppParty] = useState<string | null>(null);
  const [balances, setBalances] = useState<BalanceView[]>([]);
  const [deposits, setDeposits] = useState<DepositView[]>([]);
  const [pendingInbound, setPendingInbound] = useState<PendingInboundDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalView[]>([]);
  const [transfers, setTransfers] = useState<TransferView[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const loadProfile = useCallback(async () => {
    if (!email) return;
    const p = await fetchWalletProfile(email);
    setProfile(p);
    setAppParty(p.appPartyId);
    return p;
  }, [email]);

  const loadAccountData = useCallback(async (party: string) => {
    // Use allSettled so one failing section doesn't blank the others, but DON'T
    // silently substitute empty data on failure — that could show "no balances"
    // during an auth/outage error and make a funded user think they have zero.
    const [b, d, p, w, t, k] = await Promise.allSettled([
      fetchBalances(party),
      listDeposits(party),
      listPendingDeposits(party),
      listWithdrawals(party),
      listTransfers(party),
      listApiKeys(party),
    ]);
    if (b.status === "fulfilled") setBalances(b.value.balances);
    if (d.status === "fulfilled") setDeposits(d.value.deposits);
    if (p.status === "fulfilled") setPendingInbound(p.value.pending);
    if (w.status === "fulfilled") setWithdrawals(w.value.withdrawals);
    if (t.status === "fulfilled") setTransfers(t.value.transfers);
    if (k.status === "fulfilled") setApiKeys(k.value.keys);
    const failed = [b, d, p, w, t, k].filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed.length > 0) {
      const reason = failed
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .find(Boolean);
      const ledgerDenied = /403|security-sensitive|Active contracts/i.test(reason ?? "");
      setNotice({
        type: "error",
        text: ledgerDenied
          ? "Balances unavailable: ledger user cannot read this party yet (missing CanReadAs). Re-activate or grant rights on the participant, then refresh."
          : `Some account data could not be loaded${reason ? `: ${reason}` : ""}. Refresh to retry.`,
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const p = await loadProfile();
        if (!cancelled && p?.appPartyId) {
          await loadAccountData(p.appPartyId);
        }
      } catch (err) {
        // The profile endpoint returns a record (with a null appPartyId) for
        // brand-new users, so a thrown error is a real failure — surface it
        // instead of silently showing the "activate account" state.
        if (!cancelled) {
          setNotice({
            type: "error",
            text: err instanceof Error ? err.message : "Could not load your account.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfile, loadAccountData]);

  const refresh = useCallback(async () => {
    if (appParty) await loadAccountData(appParty);
  }, [appParty, loadAccountData]);

  async function activate() {
    if (!email || activating) return;
    setActivating(true);
    setNotice(null);
    try {
      const { account } = await onboardAccount(email, profile?.loopPartyId ?? undefined);
      setAppParty(account.appPartyId);
      await loadProfile();
      await loadAccountData(account.appPartyId);
      setNotice({ type: "success", text: "Trading account activated." });
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Activation failed" });
    } finally {
      setActivating(false);
    }
  }

  return (
    <>
      <section className="hero-premium hero-compact">
        <div className="hero-premium-content">
          <span className="hero-eyebrow">Account · Custody</span>
          <h1>Deposit, trade, withdraw</h1>
          <p>
            Deposit from your Loop wallet into your app party on our validator, trade with low
            latency, and withdraw back to Loop. The ledger is the source of truth.
          </p>
        </div>
      </section>

      {notice && (
        <div className={`alert alert-${notice.type === "success" ? "success" : "error"}`}>
          {notice.text}
        </div>
      )}

      {loading ? (
        <div className="empty-state empty-state-premium">
          <span className="spinner" /> Loading account…
        </div>
      ) : !appParty ? (
        <section className="panel panel-glass">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Activate trading account</h2>
              <p className="panel-subtitle">
                Provision an app party on our validator to deposit and trade.
              </p>
            </div>
          </div>
          <div className="account-identity">
            <IdRow label="Login" value={email ?? "—"} />
            <IdRow label="Linked Loop party" value={profile?.loopPartyId ?? profile?.cantonPartyId ?? "Not linked"} />
          </div>
          {!profile?.loopPartyId && !profile?.cantonPartyId && (
            <p className="field-hint">
              Connect Wallet from the account menu so withdrawals can be locked to your address.
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-glow"
            onClick={activate}
            disabled={activating}
          >
            {activating ? "Activating…" : "Activate trading account"}
          </button>
        </section>
      ) : (
        <>
          <section className="panel panel-glass">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Identity</h2>
                <p className="panel-subtitle">Your parties</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={refresh}>
                Refresh
              </button>
            </div>
            <div className="account-identity">
              {!isDemoMode() && <IdRow label="App party (trading)" value={appParty} mono />}
              <IdRow
                label="Linked Loop party (withdraw destination)"
                value={
                  isDemoMode()
                    ? "Linked (hidden in demo)"
                    : (profile?.loopPartyId ?? profile?.cantonPartyId ?? "Not linked")
                }
                mono={!isDemoMode()}
              />
              {profile?.sponsoredCc && parseFloat(profile.sponsoredCc) > 0 && (
                <IdRow label="Traffic sponsored" value={`${formatAmount(profile.sponsoredCc)} CC`} />
              )}
            </div>
            {profile?.accountStatus && profile.accountStatus !== "ACTIVE" && (
              <div className="alert alert-error">
                Account {profile.accountStatus.toLowerCase()} — trading and withdrawals are paused.
                Contact support.
              </div>
            )}
          </section>

          <BalancesPanel balances={balances} />

          <PendingInboundPanel
            appParty={appParty}
            pending={pendingInbound}
            onDone={async (n) => {
              setNotice(n);
              await refresh();
            }}
          />

          <section className="fund-ops">
            <DepositPanel
              appParty={appParty}
              loopReady={walletKind === "loop" && Boolean(wallet?.partyId)}
              transfer={transfer}
              onDone={async (n) => {
                setNotice(n);
                await refresh();
              }}
            />
            <WithdrawPanel
              appParty={appParty}
              destination={profile?.loopPartyId ?? profile?.cantonPartyId ?? null}
              onDone={async (n) => {
                setNotice(n);
                await refresh();
              }}
            />
          </section>

          <SendPanel
            appParty={appParty}
            onDone={async (n) => {
              setNotice(n);
              await refresh();
            }}
          />

          <DepositsHistory deposits={deposits} />

          <WithdrawalsHistory withdrawals={withdrawals} />

          <TransfersHistory transfers={transfers} />

          <ApiKeysPanel
            appParty={appParty}
            keys={apiKeys}
            onChanged={refresh}
            setNotice={setNotice}
          />
        </>
      )}
    </>
  );
}

function IdRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="account-id-row">
      <span className="account-id-label">{label}</span>
      <span className={mono ? "input-mono account-id-value" : "account-id-value"}>{value}</span>
    </div>
  );
}

function BalancesPanel({ balances }: { balances: BalanceView[] }) {
  return (
    <section className="panel panel-glass">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Trading balances</h2>
          <p className="panel-subtitle">On-ledger holdings on your app party</p>
        </div>
      </div>
      {balances.length === 0 ? (
        <div className="empty-state empty-state-premium">
          <div className="empty-state-icon">◎</div>
          <p>No balances yet</p>
          <span className="empty-state-sub">Deposit from Loop to start trading</span>
        </div>
      ) : (
        <div className="balance-grid">
          {balances.map((b) => (
            <div key={b.instrument} className="balance-card">
              <span className="balance-symbol">{b.symbol}</span>
              <span className="balance-available">{formatAmount(b.available)}</span>
              <span className="balance-sub">
                {formatAmount(b.total)} total · {formatAmount(b.locked)} locked
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PendingInboundPanel({
  appParty,
  pending,
  onDone,
}: {
  appParty: string;
  pending: PendingInboundDeposit[];
  onDone: (n: Notice) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (pending.length === 0) return null;

  async function acceptAll() {
    setBusy(true);
    try {
      const result = await acceptPendingDeposits(appParty);
      if (result.accepted > 0 && result.failed.length === 0) {
        onDone({
          type: "success",
          text: `Accepted ${result.accepted} pending deposit${result.accepted === 1 ? "" : "s"}. Balances updated.`,
        });
      } else if (result.accepted > 0) {
        onDone({
          type: "error",
          text: `Accepted ${result.accepted}, but ${result.failed.length} failed. ${result.failed[0]?.error ?? "Check scan-proxy health."}`,
        });
      } else {
        const hint = result.failed[0]?.error ?? "Unknown error";
        const scanDown = /fetch failed|ECONNREFUSED|Empty reply|scan/i.test(hint);
        onDone({
          type: "error",
          text: scanDown
            ? `Could not accept deposits: Scan registry unreachable (${hint}). Restart validator scan-proxy, then retry.`
            : `Could not accept deposits: ${hint}`,
        });
      }
    } catch (err) {
      onDone({
        type: "error",
        text: err instanceof Error ? err.message : "Accept pending deposits failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-glass pending-inbound">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Pending deposits</h2>
          <p className="panel-subtitle">
            Funds sent to Helvex but not yet credited — Accept to move them into trading balances
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={acceptAll}
          disabled={busy}
        >
          {busy ? "Accepting…" : `Accept all (${pending.length})`}
        </button>
      </div>
      <div className="intent-list">
        {pending.map((p) => (
          <article key={p.contractId} className="intent-card">
            <div className="intent-card-top">
              <div className="intent-amounts">
                {formatAmount(p.amount)} {p.symbol}
              </div>
              <span className="status-badge status-pending">PENDING ACCEPT</span>
            </div>
            <div className="intent-meta">
              <span title={p.sender}>From {shortPartyId(p.sender)}</span>
              {p.executeBefore && (
                <span>Expires {formatUtcDateTime(p.executeBefore)}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DepositPanel({
  appParty,
  loopReady,
  transfer,
  onDone,
}: {
  appParty: string;
  loopReady: boolean;
  transfer: (input: {
    to: string;
    amount: string;
    instrumentId?: string;
    loopInstrument?: { instrument_id: string; instrument_admin?: string };
  }) => Promise<void>;
  onDone: (n: Notice) => void;
}) {
  const [instrument, setInstrument] = useState<Instrument>("CC");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [depositTo, setDepositTo] = useState<string | null>(null);

  async function submit() {
    if (!isValidAmount(amount)) {
      onDone({ type: "error", text: "Enter a valid amount greater than zero." });
      return;
    }
    if (!loopReady) {
      onDone({
        type: "error",
        text: isDemoMode()
          ? "Connect Wallet from the account menu, then deposit."
          : "Connect Wallet from the account menu before depositing.",
      });
      return;
    }
    setBusy(true);
    try {
      const { depositTo: to, loopInstrument } = await prepareDeposit(appParty, {
        instrument,
        amount,
        idempotencyKey: newIdempotencyKey(),
      });
      setDepositTo(to);
      try {
        await transfer({ to, amount, instrumentId: instrument, loopInstrument });
        onDone({ type: "success", text: "Deposit transfer submitted from Loop." });
        setAmount("");
      } catch (err) {
        onDone({
          type: "error",
          text: isDemoMode()
            ? "Deposit needs Loop approval — open the Loop popup and confirm the transfer."
            : err instanceof Error
              ? `Prepared. Loop transfer failed: ${err.message}. Send ${amount} ${instrument} to ${to} manually.`
              : "Loop transfer failed.",
        });
      }
    } catch (err) {
      onDone({
        type: "error",
        text: isDemoMode()
          ? "Deposit unavailable — connect Loop and try again."
          : err instanceof Error
            ? err.message
            : "Deposit failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-glass fund-ops-card">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Deposit</h2>
          <p className="panel-subtitle">Loop wallet → Helvex trading party</p>
        </div>
      </div>
      <div className="fund-ops-fields">
        <div className="field">
          <label htmlFor="dep-instrument">Token</label>
          <select
            id="dep-instrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value as Instrument)}
          >
            {INSTRUMENTS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="dep-amount">Amount</label>
          <input
            id="dep-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="input-mono"
          />
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary fund-ops-btn"
        onClick={submit}
        disabled={busy || !isValidAmount(amount)}
      >
        {busy ? <span className="spinner" /> : loopReady ? "Deposit from Loop" : "Prepare deposit"}
      </button>
      {!isDemoMode() && (
        <p className="fund-ops-meta" title={depositTo ?? appParty}>
          <span>To trading party</span>
          <code>{shortPartyId(depositTo ?? appParty)}</code>
        </p>
      )}
    </section>
  );
}

function WithdrawPanel({
  appParty,
  destination,
  onDone,
}: {
  appParty: string;
  destination: string | null;
  onDone: (n: Notice) => void;
}) {
  const [instrument, setInstrument] = useState<Instrument>("CC");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!isValidAmount(amount)) {
      onDone({ type: "error", text: "Enter a valid amount greater than zero." });
      return;
    }
    if (!destination) {
      onDone({
        type: "error",
        text: isDemoMode()
          ? "Connect Wallet from the account menu, then withdraw."
          : "Connect Wallet from the account menu before withdrawing.",
      });
      return;
    }
    setBusy(true);
    try {
      await requestWithdrawal(appParty, {
        instrument,
        amount,
        idempotencyKey: newIdempotencyKey(),
      });
      onDone({ type: "success", text: "Withdrawal requested. Funds return to your Loop party." });
      setAmount("");
    } catch (err) {
      onDone({
        type: "error",
        text: isDemoMode()
          ? "Withdrawal unavailable right now — check balance and try again."
          : err instanceof Error
            ? err.message
            : "Withdrawal failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-glass fund-ops-card">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Withdraw</h2>
          <p className="panel-subtitle">Helvex trading party → Loop wallet</p>
        </div>
      </div>
      <div className="fund-ops-fields">
        <div className="field">
          <label htmlFor="wd-instrument">Token</label>
          <select
            id="wd-instrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value as Instrument)}
          >
            {INSTRUMENTS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="wd-amount">Amount</label>
          <input
            id="wd-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="input-mono"
          />
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary fund-ops-btn"
        onClick={submit}
        disabled={busy || !isValidAmount(amount) || !destination}
      >
        {busy ? <span className="spinner" /> : "Request withdrawal"}
      </button>
      <p className="fund-ops-meta" title={destination ?? undefined}>
        <span>To Loop (locked)</span>
        <code>{destination ? shortPartyId(destination) : "Connect Wallet first"}</code>
      </p>
    </section>
  );
}

function SendPanel({
  appParty,
  onDone,
}: {
  appParty: string;
  onDone: (n: Notice) => void;
}) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [instrument, setInstrument] = useState<Instrument>("CC");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!recipientEmail) {
      onDone({ type: "error", text: "Enter a recipient email." });
      return;
    }
    if (!isValidAmount(amount)) {
      onDone({ type: "error", text: "Enter a valid amount greater than zero." });
      return;
    }
    setBusy(true);
    try {
      await sendTransfer(appParty, {
        recipientEmail: recipientEmail.trim().toLowerCase(),
        instrument,
        amount,
        idempotencyKey: newIdempotencyKey(),
      });
      onDone({ type: "success", text: `Sent ${amount} ${instrument} to ${recipientEmail}.` });
      setAmount("");
      setRecipientEmail("");
    } catch (err) {
      onDone({ type: "error", text: err instanceof Error ? err.message : "Transfer failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-glass">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Send to a user</h2>
          <p className="panel-subtitle">Instant, fee-free transfer to another Helvex account</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="xfer-email">Recipient email</label>
        <input
          id="xfer-email"
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="recipient@example.com"
        />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="xfer-instrument">Token</label>
          <select
            id="xfer-instrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value as Instrument)}
          >
            {INSTRUMENTS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="xfer-amount">Amount</label>
          <input
            id="xfer-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="input-mono"
          />
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={submit}
        disabled={busy || !isValidAmount(amount) || !recipientEmail}
      >
        {busy ? <span className="spinner" /> : "Send"}
      </button>
      <p className="field-hint">
        Both accounts settle on our validator, so transfers are instant with no Loop withdrawal fee.
        Daily limits apply based on your KYC tier.
      </p>
    </section>
  );
}

function TransfersHistory({ transfers }: { transfers: TransferView[] }) {
  const visible = transfers.filter((t) => t.status !== "FAILED").slice(0, 10);
  if (visible.length === 0) return null;
  return (
    <section className="panel panel-glass">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Recent transfers</h2>
          <p className="panel-subtitle">{visible.length} total</p>
        </div>
      </div>
      <div className="intent-list">
        {visible.map((t) => {
          const counterparty = t.direction === "OUT" ? t.recipientAppParty : t.senderAppParty;
          return (
            <article key={t.id} className="intent-card">
              <div className="intent-card-top">
                <div className="intent-amounts">
                  {t.direction === "OUT" ? "−" : "+"}
                  {formatAmount(t.amount)} {t.instrument}
                </div>
                <span className={`status-badge status-${t.status.toLowerCase()}`}>{t.status}</span>
              </div>
              <div className="intent-meta">
                <span>{t.direction === "OUT" ? "To" : "From"}</span>
                <span className="intent-id" title={counterparty ?? ""}>
                  {counterparty ? `${counterparty.slice(0, 16)}…` : "—"}
                </span>
                <span>{formatUtcDateTime(t.createdAt)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WithdrawalsHistory({ withdrawals }: { withdrawals: WithdrawalView[] }) {
  const visible = withdrawals.filter((w) => w.status !== "FAILED").slice(0, 10);
  if (visible.length === 0) return null;
  return (
    <section className="panel panel-glass">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Recent withdrawals</h2>
          <p className="panel-subtitle">{visible.length} total · destination-locked</p>
        </div>
      </div>
      <div className="intent-list">
        {visible.map((w) => (
          <article key={w.id} className="intent-card">
            <div className="intent-card-top">
              <div className="intent-amounts">
                −{formatAmount(w.amount)} {w.instrument}
              </div>
              <span className={`status-badge status-${w.status.toLowerCase()}`}>{w.status}</span>
            </div>
            <div className="intent-meta">
              <span>To</span>
              <span className="intent-id" title={w.destLoopParty ?? ""}>
                {w.destLoopParty ? `${w.destLoopParty.slice(0, 16)}…` : "—"}
              </span>
              <span>{formatUtcDateTime(w.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DepositsHistory({ deposits }: { deposits: DepositView[] }) {
  const visible = deposits.filter((d) => d.status !== "FAILED").slice(0, 10);
  if (visible.length === 0) return null;
  return (
    <section className="panel panel-glass">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Recent deposits</h2>
          <p className="panel-subtitle">{visible.length} total</p>
        </div>
      </div>
      <div className="intent-list">
        {visible.map((d) => (
          <article key={d.id} className="intent-card">
            <div className="intent-card-top">
              <div className="intent-amounts">
                {formatAmount(d.amount)} {d.instrument}
              </div>
              <span className={`status-badge status-${d.status.toLowerCase()}`}>{d.status}</span>
            </div>
            <div className="intent-meta">
              <span>{formatUtcDateTime(d.createdAt)}</span>
              {d.ledgerTxId && (
                <span className="intent-id" title={d.ledgerTxId}>
                  {d.ledgerTxId.slice(0, 10)}…
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ApiKeysPanel({
  appParty,
  keys,
  onChanged,
  setNotice,
}: {
  appParty: string;
  keys: ApiKeyView[];
  onChanged: () => Promise<void>;
  setNotice: (n: Notice) => void;
}) {
  const [label, setLabel] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(["read", "maker"]);
  const [marketMaker, setMarketMaker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ keyId: string; secret: string } | null>(null);

  function toggleScope(scope: ApiKeyScope) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function create() {
    if (selectedScopes.length === 0) {
      setNotice({ type: "error", text: "Select at least one scope." });
      return;
    }
    setBusy(true);
    setCreated(null);
    try {
      const res = await createApiKey(appParty, {
        label: label || undefined,
        scopes: selectedScopes,
        rateTier: marketMaker ? "market_maker" : "default",
      });
      setCreated({ keyId: res.keyId, secret: res.secret });
      setLabel("");
      await onChanged();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Key creation failed" });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      await revokeApiKey(appParty, id);
      await onChanged();
      setNotice({ type: "success", text: "API key revoked." });
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Revoke failed" });
    }
  }

  return (
    <section className="panel panel-glass">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">API keys</h2>
          <p className="panel-subtitle">For bots & market makers (HMAC-signed)</p>
        </div>
      </div>

      <div className="field">
        <label htmlFor="key-label">Label</label>
        <input
          id="key-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Trading bot v1"
        />
      </div>

      <div className="field">
        <label>Scopes</label>
        <div className="scope-row">
          {SCOPES.map((s) => (
            <label key={s} className="chip-checkbox">
              <input
                type="checkbox"
                checked={selectedScopes.includes(s)}
                onChange={() => toggleScope(s)}
              />
              <span>{s}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={marketMaker}
          onChange={(e) => setMarketMaker(e.target.checked)}
        />
        <span>Market-maker rate tier (higher limits)</span>
      </label>

      <button type="button" className="btn btn-primary" onClick={create} disabled={busy}>
        {busy ? <span className="spinner" /> : "Create API key"}
      </button>

      {created && (
        <div className="alert alert-success">
          <strong>Save this secret now — it is shown only once.</strong>
          <div className="key-reveal">
            <div>
              <span className="account-id-label">Key ID</span>
              <span className="input-mono">{created.keyId}</span>
            </div>
            <div>
              <span className="account-id-label">Secret</span>
              <span className="input-mono">{created.secret}</span>
            </div>
          </div>
        </div>
      )}

      {keys.length > 0 && (
        <div className="intent-list" style={{ marginTop: "1rem" }}>
          {keys.map((k) => (
            <article key={k.id} className="intent-card">
              <div className="intent-card-top">
                <div>
                  <div className="intent-amounts">{k.label ?? k.keyId}</div>
                  <div className="field-hint">
                    {k.scopes.join(", ")} · {k.rateTier ?? "default"}
                  </div>
                </div>
                {k.active ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => revoke(k.id)}>
                    Revoke
                  </button>
                ) : (
                  <span className="status-badge">Revoked</span>
                )}
              </div>
              <div className="intent-meta">
                <span className="input-mono">{k.keyId}</span>
                <span>
                  {k.lastUsedAt ? `Used ${formatUtcDate(k.lastUsedAt)}` : "Never used"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
