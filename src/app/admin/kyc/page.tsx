"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  approveKycRequest,
  fetchAdminKycRequests,
  freezeAccount,
  rejectKycRequest,
  type KycRequestView,
} from "../../../lib/api";

export default function AdminKycPage() {
  const [requests, setRequests] = useState<KycRequestView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSetup, setLastSetup] = useState<string | null>(null);
  const [partyInputs, setPartyInputs] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);
  const [freezeParty, setFreezeParty] = useState("");
  const [freezeMsg, setFreezeMsg] = useState<string | null>(null);
  // Admin key is held ONLY in memory for the life of this tab — never persisted
  // to localStorage/sessionStorage (avoids XSS/extension theft of a privileged
  // credential). No admin action runs until a valid key unlocks the desk.
  const [adminKey, setAdminKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const loadRequests = useCallback(async (key: string) => {
    const res = await fetchAdminKycRequests(key, "SUBMITTED");
    setRequests(res.requests);
  }, []);

  async function unlock() {
    const key = keyInput.trim();
    if (!key) {
      setError("Admin key required.");
      return;
    }
    setUnlocking(true);
    setError(null);
    try {
      // Verify the key by making a real admin call; the proxy rejects a bad key.
      await loadRequests(key);
      setAdminKey(key);
      setUnlocked(true);
      setKeyInput("");
    } catch (err) {
      setUnlocked(false);
      setError(err instanceof Error ? err.message : "Invalid admin key");
    } finally {
      setUnlocking(false);
    }
  }

  function lock() {
    setAdminKey("");
    setUnlocked(false);
    setRequests([]);
    setLastSetup(null);
    setFreezeMsg(null);
  }

  async function setFrozen(frozen: boolean) {
    const appParty = freezeParty.trim();
    if (!appParty) {
      setFreezeMsg("App party ID required.");
      return;
    }
    setFreezeMsg(null);
    try {
      const { account } = await freezeAccount(adminKey, appParty, frozen);
      setFreezeMsg(`Account ${account.appPartyId.slice(0, 18)}… is now ${account.status}.`);
    } catch (err) {
      setFreezeMsg(err instanceof Error ? err.message : "Freeze action failed");
    }
  }

  const refresh = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setError(null);
    try {
      await loadRequests(adminKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [adminKey, loadRequests]);

  async function approve(request: KycRequestView) {
    if (actingId) return;
    const cantonPartyId = partyInputs[request.id]?.trim();
    if (cantonPartyId && !cantonPartyId.includes("::")) {
      setError("Party ID must look like name::1220… — or leave blank (link via Connect Loop later).");
      return;
    }
    setError(null);
    setActingId(request.id);
    try {
      const result = await approveKycRequest(adminKey, request.id, {
        ...(cantonPartyId ? { cantonPartyId } : {}),
        role: request.requestedRole as "MAKER" | "SOLVER" | "BOTH",
      });
      setLastSetup(
        cantonPartyId
          ? `Approved ${result.email}. Setup link: ${window.location.origin}${result.setupUrl}`
          : `Approved ${result.email} (no Loop party yet — they Connect Loop after login). Setup: ${window.location.origin}${result.setupUrl}`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setActingId(null);
    }
  }

  async function reject(request: KycRequestView) {
    if (actingId) return;
    setError(null);
    setActingId(request.id);
    try {
      await rejectKycRequest(adminKey, request.id, "Does not meet eligibility requirements.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setActingId(null);
    }
  }

  if (!unlocked) {
    return (
      <div className="auth-page-center">
        <div className="login-card">
          <div className="panel-header">
            <div>
              <Link href="/login" className="auth-back-link">
                ← Sign in
              </Link>
              <h1 className="panel-title">Admin access</h1>
              <p className="panel-subtitle">
                Enter the operator admin key to unlock the KYC / compliance desk.
              </p>
            </div>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label htmlFor="admin-key">Admin key</label>
            <input
              id="admin-key"
              type="password"
              autoComplete="off"
              placeholder="ADMIN_API_KEY"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void unlock();
              }}
              className="input-mono"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void unlock()}
            disabled={unlocking}
          >
            {unlocking ? "Unlocking…" : "Unlock"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-center auth-page-wide">
      <div className="login-card login-card-wide">
        <div className="panel-header">
          <div>
            <Link href="/login" className="auth-back-link">
              ← Sign in
            </Link>
            <h1 className="panel-title">KYC review desk</h1>
            <p className="panel-subtitle">
              Operator-only · set ADMIN_API_KEY + ADMIN_UI_ENABLED=true on the web server
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={lock}>
            Lock
          </button>
        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
          {loading ? "Loading…" : "Refresh pending"}
        </button>

        {error && <div className="alert alert-error">{error}</div>}
        {lastSetup && <div className="alert alert-success setup-link-alert">{lastSetup}</div>}

        {requests.length === 0 && !loading ? (
          <div className="empty-state empty-state-premium">
            <p>No pending KYC requests</p>
          </div>
        ) : (
          <div className="kyc-admin-list">
            {requests.map((request) => (
              <article key={request.id} className="intent-card intent-card-premium kyc-admin-row">
                <div>
                  <strong>{request.fullName}</strong>
                  <span className="kyc-admin-email">{request.email}</span>
                  <span className="kyc-admin-meta">
                    {request.countryCode} · {request.requestedRole}
                    {request.profileType ? ` · ${request.profileType.replace("_", " ")}` : ""}
                    {request.institution ? ` · ${request.institution}` : ""}
                  </span>
                  {request.diditStatus && (
                    <span className="kyc-admin-meta">
                      Didit: <strong>{request.diditStatus}</strong>
                      {request.diditStatus === "In Review"
                        ? " — automated checks were inconclusive, decide manually"
                        : ""}
                    </span>
                  )}
                  {request.notes && <p className="field-hint">{request.notes}</p>}
                </div>
                <div className="kyc-admin-actions">
                  <input
                    type="text"
                    placeholder="optional Loop party (or leave blank)"
                    value={partyInputs[request.id] ?? ""}
                    onChange={(e) =>
                      setPartyInputs((prev) => ({ ...prev, [request.id]: e.target.value }))
                    }
                    className="input-mono"
                  />
                  <div className="kyc-admin-buttons">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => approve(request)}
                      disabled={actingId !== null}
                    >
                      {actingId === request.id ? "Working…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => reject(request)}
                      disabled={actingId !== null}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="field" style={{ marginTop: "1.5rem" }}>
          <label htmlFor="freeze-party">Compliance · freeze / unfreeze account</label>
          <input
            id="freeze-party"
            type="text"
            placeholder="App party ID"
            value={freezeParty}
            onChange={(e) => setFreezeParty(e.target.value)}
            className="input-mono"
          />
          <div className="kyc-admin-buttons" style={{ marginTop: "0.5rem" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFrozen(true)}>
              Freeze
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setFrozen(false)}>
              Unfreeze
            </button>
          </div>
          {freezeMsg && <p className="field-hint">{freezeMsg}</p>}
        </div>
      </div>
    </div>
  );
}
