"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { fetchKycStatus } from "../../../lib/api";

// Didit appends `?verificationSessionId=…&status=…`, but that is only what the
// browser was told. The signed webhook is what actually flips the account to
// VERIFIED, so this polls our own API instead of trusting the query string.

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 45;

type Phase = "waiting" | "approved" | "declined" | "review" | "unknown";

function KycCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const reportedStatus = params.get("status");

  const [email, setEmail] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [attempts, setAttempts] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      setEmail(window.sessionStorage.getItem("helvex.kycEmail"));
    } catch {
      setEmail(null);
    }
  }, []);

  useEffect(() => {
    if (reportedStatus === "Declined") setPhase("declined");
  }, [reportedStatus]);

  const poll = useCallback(async () => {
    if (!email) return;
    try {
      const status = await fetchKycStatus(email);
      if (status.kycStatus === "VERIFIED") {
        setPhase("approved");
        try {
          window.sessionStorage.removeItem("helvex.kycEmail");
        } catch {
          // storage disabled
        }
        return;
      }
      if (status.kycStatus === "REJECTED" || status.requestStatus === "REJECTED") {
        setPhase("declined");
        return;
      }
    } catch {
      // Transient failure — keep polling until the attempt budget runs out.
    }
    setAttempts((n) => n + 1);
  }, [email]);

  useEffect(() => {
    if (phase !== "waiting" || !email) return;
    if (attempts >= MAX_POLL_ATTEMPTS) {
      setPhase("review");
      return;
    }
    timer.current = setTimeout(poll, attempts === 0 ? 0 : POLL_INTERVAL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [phase, email, attempts, poll]);

  if (phase === "approved") {
    return (
      <Shell title="Identity verified">
        <p>
          Your identity check passed. Create a password to activate your Helvex account.
        </p>
        <button
          className="btn btn-primary btn-glow"
          onClick={() => router.push(`/setup-password?email=${encodeURIComponent(email ?? "")}`)}
        >
          Create password
        </button>
      </Shell>
    );
  }

  if (phase === "declined") {
    return (
      <Shell title="Verification unsuccessful">
        <p>
          We could not verify your identity from the documents provided. If you believe this
          is a mistake, contact the Helvex operations team.
        </p>
        <Link href="/login" className="btn btn-primary btn-glow">
          Back to sign in
        </Link>
      </Shell>
    );
  }

  if (phase === "review" || !email) {
    return (
      <Shell title="Under review">
        <p>
          {email
            ? "Your verification needs a manual check. You'll receive an email once the operations team completes the review."
            : "Thanks — your verification was submitted. You'll receive an email once it has been reviewed."}
        </p>
        <Link href="/login" className="btn btn-primary btn-glow">
          Back to sign in
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title="Checking your verification">
      <div className="access-spinner" aria-hidden />
      <p>This usually takes a few seconds. Please don&apos;t close this page.</p>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth-page-center">
      <div className="login-card">
        <div className="login-card-header">
          <h1>{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function KycCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page-center">
          <div className="access-spinner" />
        </div>
      }
    >
      <KycCallback />
    </Suspense>
  );
}
