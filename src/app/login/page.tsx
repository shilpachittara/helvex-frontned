"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { fetchKycStatus } from "../../lib/api";
import { isDemoMode } from "../../lib/demo-mode";
import { safeCallback } from "../../lib/safe-redirect";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = safeCallback(params.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const status = await fetchKycStatus(email);

      if (status.requestStatus === "SUBMITTED") {
        setError("Your KYC application is under review. You'll receive a setup link after approval.");
        return;
      }
      if (status.requestStatus === "REJECTED" || status.kycStatus === "REJECTED") {
        setError("Your KYC application was not approved. Contact the protocol operator.");
        return;
      }
      if (status.canSetupPassword) {
        setInfo("Your account is approved. Create your password to continue.");
        router.push(
          `/setup-password?email=${encodeURIComponent(email.trim().toLowerCase())}`,
        );
        return;
      }
      if (!status.canLogin && status.kycStatus !== "VERIFIED") {
        setError("No approved account for this email. Submit a KYC request first.");
        return;
      }

      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Approved users must complete password setup first.");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    try {
      const result = await signIn("google", { callbackUrl, redirect: false });
      if (result?.error) {
        setError(
          "Google sign-in is only available for KYC-verified accounts with an active password.",
        );
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-visual">
        <div className="login-visual-inner">
          <div className="login-brand-large">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/helvex-mark.svg" alt="Helvex" width={52} height={52} className="brand-mark-img brand-mark-img-lg" />
            <div>
              <h2>{process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Helvex"}</h2>
              <p>Institutional-grade RFQ on Canton Network</p>
            </div>
          </div>
          <ul className="login-features">
            <li>
              <span className="feature-icon">◆</span>
              KYC-verified access only
            </li>
            <li>
              <span className="feature-icon">◆</span>
              Request access → approval → password setup → sign in
            </li>
            <li>
              <span className="feature-icon">◆</span>
              Atomic DvP · CBTC · USDCx · CC
            </li>
          </ul>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <div className="login-card-header">
            <h1>Sign in</h1>
            <p>Only KYC-approved users with an active password can access the trading desk.</p>
          </div>

          <form onSubmit={onSubmit} className="login-form">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@institution.com"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {info && <div className="alert alert-success">{info}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            <button type="submit" className="btn btn-primary btn-glow" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {googleEnabled && (
            <>
              <div className="login-divider">
                <span>or</span>
              </div>
              <button
                type="button"
                className="btn btn-google"
                onClick={onGoogle}
                disabled={googleLoading}
              >
                {googleLoading ? "Connecting…" : "Continue with Google"}
              </button>
              <p className="field-hint" style={{ textAlign: "center", marginTop: "0.5rem" }}>
                Google works only after KYC approval and password setup.
              </p>
            </>
          )}

          <div className="login-auth-links">
            <Link href="/kyc">Request KYC access</Link>
            <span>·</span>
            <Link href="/setup-password">Set up password</Link>
          </div>

          {process.env.NODE_ENV !== "production" && !isDemoMode() && (
            <div className="login-demo-hint">
              <p className="section-label">Dev demo (pre-approved)</p>
              <code>maker@demo.local</code> / <code>Demo123!</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-loading">
          <div className="access-spinner" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
