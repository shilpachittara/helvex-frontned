"use client";

import Link from "next/link";
import { useState } from "react";
import { submitKycRequest, type ProfileType } from "../../lib/api";

const PROFILE_TYPES: { value: ProfileType; label: string }[] = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "INSTITUTION", label: "Institution" },
  { value: "MARKET_MAKER", label: "Market maker" },
  { value: "LIQUIDITY_PROVIDER", label: "Liquidity provider" },
];

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CH", name: "Switzerland" },
  { code: "SG", name: "Singapore" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" },
  { code: "HK", name: "Hong Kong" },
];

export default function KycRequestPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [profileType, setProfileType] = useState<ProfileType>("INDIVIDUAL");
  const [legalName, setLegalName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = useState("");
  const [automatedTrading, setAutomatedTrading] = useState(false);
  const [sourceOfFunds, setSourceOfFunds] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInstitutional = profileType !== "INDIVIDUAL";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await submitKycRequest({
        email,
        fullName,
        countryCode,
        profileType,
        // Every verified user can post and fill — no separate maker/solver accounts.
        requestedRole: "BOTH",
        institution: isInstitutional
          ? {
              legalName,
              jurisdiction,
              expectedMonthlyVolume: expectedMonthlyVolume || undefined,
              automatedTrading,
              sourceOfFunds: sourceOfFunds || undefined,
            }
          : undefined,
        notes: notes || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="auth-page-center">
        <div className="login-card">
          <div className="login-card-header">
            <h1>Application received</h1>
            <p>
              Your KYC request is under review. You will receive an email with a password setup
              link once approved.
            </p>
          </div>
          <Link href="/login" className="btn btn-primary btn-glow">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-center">
      <div className="login-card login-card-wide">
        <div className="login-card-header">
          <Link href="/login" className="auth-back-link">
            ← Sign in
          </Link>
          <h1>Request access</h1>
          <p>
            Helvex is permissioned. Submit KYC details for operator review. Only approved
            users can create a password and sign in.
          </p>
        </div>

        <form onSubmit={onSubmit} className="login-form">
          <div className="field-row">
            <div className="field">
              <label htmlFor="kyc-email">Work email</label>
              <input
                id="kyc-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@institution.com"
              />
            </div>
            <div className="field">
              <label htmlFor="kyc-name">Full legal name</label>
              <input
                id="kyc-name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="kyc-country">Country of residence</label>
              <select
                id="kyc-country"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="kyc-profile">Profile type</label>
              <select
                id="kyc-profile"
                value={profileType}
                onChange={(e) => setProfileType(e.target.value as ProfileType)}
              >
                {PROFILE_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isInstitutional && (
            <>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="kyc-legal-name">Legal entity name</label>
                  <input
                    id="kyc-legal-name"
                    required={isInstitutional}
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Acme Capital Ltd."
                  />
                </div>
                <div className="field">
                  <label htmlFor="kyc-jurisdiction">Jurisdiction</label>
                  <input
                    id="kyc-jurisdiction"
                    required={isInstitutional}
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    placeholder="Cayman Islands"
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="kyc-volume">Expected monthly volume (optional)</label>
                  <input
                    id="kyc-volume"
                    value={expectedMonthlyVolume}
                    onChange={(e) => setExpectedMonthlyVolume(e.target.value)}
                    placeholder="$10M"
                  />
                </div>
                <div className="field">
                  <label htmlFor="kyc-source">Source of funds (optional)</label>
                  <input
                    id="kyc-source"
                    value={sourceOfFunds}
                    onChange={(e) => setSourceOfFunds(e.target.value)}
                    placeholder="Proprietary trading capital"
                  />
                </div>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={automatedTrading}
                  onChange={(e) => setAutomatedTrading(e.target.checked)}
                />
                <span>We operate automated / algorithmic trading via the API.</span>
              </label>
            </>
          )}

          <div className="field">
            <label htmlFor="kyc-notes">Additional notes (optional)</label>
            <textarea
              id="kyc-notes"
              className="textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Expected volume, Canton party ID if already provisioned…"
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-glow" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Submitting…
              </>
            ) : (
              "Submit KYC request"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
