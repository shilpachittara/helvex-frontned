"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { setupPassword } from "../../lib/api";

function SetupPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const tokenFromLink = (params.get("token") ?? "").trim().toUpperCase();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [token, setToken] = useState(tokenFromLink);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Email deep-link already carries the code — keep the field but make it quieter.
  const codeFromEmailLink = /^[A-Z0-9]{6,12}$/.test(tokenFromLink);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await setupPassword({ email, token: token.trim().toUpperCase(), password });
      setDone(true);
      redirectTimer.current = setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="auth-page-center">
        <div className="login-card">
          <div className="login-card-header">
            <h1>Password created</h1>
            <p>Redirecting you to sign in…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-center">
      <div className="login-card">
        <div className="login-card-header">
          <Link href="/login" className="auth-back-link">
            ← Sign in
          </Link>
          <h1>Create your password</h1>
          <p>
            {codeFromEmailLink
              ? "Your verification code is filled in from the email link. Set a password to activate your account."
              : "Enter the code from your approval email, then choose a password. Lost the email? Use Forgot password."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="login-form">
          <div className="field">
            <label htmlFor="setup-email">Approved email</label>
            <input
              id="setup-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="setup-token">Verification code</label>
            <input
              id="setup-token"
              required
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              className="input-mono"
              inputMode="text"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[A-Za-z0-9]{6}"
              placeholder="Email verification code"
              style={{ letterSpacing: "0.2em", textTransform: "uppercase" }}
            />
          </div>
          <div className="field">
            <label htmlFor="setup-password">New password</label>
            <input
              id="setup-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="setup-confirm">Confirm password</label>
            <input
              id="setup-confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-glow" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Saving…
              </>
            ) : (
              "Activate account"
            )}
          </button>
        </form>

        <div className="login-auth-links">
          <Link href="/forgot-password">Resend code</Link>
        </div>
      </div>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page-center">
          <div className="access-spinner" />
        </div>
      }
    >
      <SetupPasswordForm />
    </Suspense>
  );
}
