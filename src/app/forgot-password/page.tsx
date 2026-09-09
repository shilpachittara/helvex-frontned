"use client";

import Link from "next/link";
import { useState } from "react";
import { forgotPassword } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await forgotPassword({ email: email.trim().toLowerCase() });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="auth-page-center">
        <div className="login-card">
          <div className="login-card-header">
            <h1>Check your email</h1>
            <p>
              If an approved Helvex account exists for that address, we sent a link to set or
              reset your password. The reset link expires in one hour.
            </p>
          </div>
          <div className="login-auth-links">
            <Link href="/login">← Back to sign in</Link>
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
          <h1>Forgot password</h1>
          <p>
            Enter the email on your KYC-approved account. We will send a verification code and a
            link to create or reset your password.
          </p>
        </div>

        <form onSubmit={onSubmit} className="login-form">
          <div className="field">
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@institution.com"
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-glow" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
