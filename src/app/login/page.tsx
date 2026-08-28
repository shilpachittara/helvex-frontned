"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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

  // Password setup/reset must not require a session. If middleware (or an old
  // deploy) bounced the user here, send them straight to the right public page
  // and keep email/token query params from the email link.
  const passwordFlow =
    callbackUrl.startsWith("/reset-password") ||
    callbackUrl.startsWith("/forgot-password") ||
    callbackUrl.startsWith("/setup-password")
      ? callbackUrl
      : null;

  useEffect(() => {
    if (!passwordFlow) return;
    router.replace(passwordFlow);
  }, [passwordFlow, router]);

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

  if (passwordFlow) {
    return (
      <div className="auth-page-center">
        <div className="login-card">
          <div className="login-card-header">
            <h1>Continue</h1>
            <p>Taking you to password setup or reset…</p>
          </div>
          <div className="login-auth-links">
            <Link href={passwordFlow}>Continue</Link>
            <span>·</span>
            <Link href="/forgot-password">Forgot password</Link>
          </div>
        </div>
      </div>
    );
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
            <Link href="/forgot-password">Forgot password</Link>
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page-center">
          <div className="access-spinner" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
