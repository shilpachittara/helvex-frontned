"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { fetchAdminRewards, type FeaturedAppRewardsSnapshot } from "../../../lib/api";

function formatCc(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatUsd(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return `$${value}`;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function AdminRewardsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FeaturedAppRewardsSnapshot | null>(null);

  const load = useCallback(async (key: string) => {
    const snapshot = await fetchAdminRewards(key);
    setData(snapshot);
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
      await load(key);
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

  const refresh = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setError(null);
    try {
      await load(adminKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rewards");
    } finally {
      setLoading(false);
    }
  }, [adminKey, load]);

  const maxDaily = useMemo(() => {
    if (!data) return 0;
    return Math.max(0, ...data.daily.map((d) => Number(d.mintedCc) || 0));
  }, [data]);

  if (!unlocked) {
    return (
      <div className="auth-page-center">
        <div className="login-card">
          <div className="panel-header">
            <div>
              <Link href="/login" className="auth-back-link">
                ← Sign in
              </Link>
              <h1 className="panel-title">Featured app rewards</h1>
              <p className="panel-subtitle">
                Unlock to see Canton Coin earned after Helvex was featured.
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
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void unlock()} disabled={unlocking}>
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
            <div className="admin-desk-nav">
              <Link href="/admin/kyc">KYC</Link>
              <Link href="/admin/rewards" className="is-active">
                Rewards
              </Link>
            </div>
            <h1 className="panel-title">Featured app rewards</h1>
            <p className="panel-subtitle">
              Total and daily Canton Coin from Helvex&apos;s FeaturedAppRight
            </p>
          </div>
          <div className="admin-desk-actions">
            {data && (
              <span className={data.featured ? "network-badge" : "field-hint"}>
                {data.featured ? "Featured" : "Not featured"}
              </span>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void refresh()} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {data && (
          <>
            <div className="rewards-stat-grid">
              <article className="intent-card intent-card-premium">
                <span className="field-hint">Total earned</span>
                <strong className="rewards-figure">{formatCc(data.totalEarnedCc)} CC</strong>
                <span>{formatUsd(data.totalEarnedUsd)}</span>
              </article>
              <article className="intent-card intent-card-premium">
                <span className="field-hint">Today (UTC)</span>
                <strong className="rewards-figure">{formatCc(data.todayMintedCc)} CC</strong>
                <span>{formatUsd(data.todayMintedUsd)}</span>
              </article>
              <article className="intent-card intent-card-premium">
                <span className="field-hint">Unminted coupons</span>
                <strong className="rewards-figure">{formatCc(data.pendingCc)} CC</strong>
                <span>{formatUsd(data.pendingUsd)}</span>
              </article>
            </div>

            <div className="rewards-bars" aria-label="Daily minted CC">
              {data.daily.map((day) => {
                const n = Number(day.mintedCc) || 0;
                const h = maxDaily > 0 ? Math.max(n > 0 ? 8 : 3, Math.round((n / maxDaily) * 72)) : 3;
                return (
                  <div key={day.date} className="rewards-bar" title={`${day.date}: ${formatCc(day.mintedCc)} CC`}>
                    <span className="rewards-bar-fill" style={{ height: `${h}px` }} />
                    <span>{day.date.slice(8)}</span>
                  </div>
                );
              })}
            </div>

            <div className="kyc-admin-list">
              {[...data.daily].reverse().slice(0, 7).map((day) => (
                <div key={day.date} className="kyc-admin-meta">
                  <strong>{day.date}</strong> · {formatCc(day.mintedCc)} CC · {formatUsd(day.mintedUsd)}
                </div>
              ))}
            </div>

            {data.notes.length > 0 && (
              <p className="field-hint" style={{ marginTop: "1rem" }}>
                {data.notes[0]}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
