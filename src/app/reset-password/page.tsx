"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { resetPassword } from "../../lib/api";

function ResetPasswordForm() {
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
      await resetPassword({ email, token: token.trim().toUpperCase(), password });
      setDone(true);
      redirectTimer.current = setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="auth-page-center">
        <div className="login-card">
          <div className="login-card-header">
            <h1>Password updated</h1>
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
          <h1>Reset your password</h1>
          <p>
            {codeFromEmailLink
              ? "Your reset code is filled in from the email link. Choose a new password — the code expires in one hour."
              : "Enter the code from your reset email, then choose a new password. Codes expire in one hour."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="login-form">
          <div className="field">
            <label htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="reset-token">Reset code</label>
            <input
              id="reset-token"
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
            <label htmlFor="reset-password">New password</label>
            <input
              id="reset-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="reset-confirm">Confirm password</label>
            <input
              id="reset-confirm"
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
              "Update password"
            )}
          </button>
        </form>

        <div className="login-auth-links">
          <Link href="/forgot-password">Request a new code</Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page-center">
          <div className="access-spinner" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
