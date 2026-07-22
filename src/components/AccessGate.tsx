"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fetchAccessCheck, fetchAccessSession, type AccessCheck, type AccessSession } from "../lib/api";

const AccessContext = createContext<AccessSession | null>(null);

/** Auth/onboarding routes that must render even if the access API is down. */
const PUBLIC_PREFIXES = ["/login", "/kyc", "/setup-password"];

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function useAccessSession(): AccessSession | null {
  return useContext(AccessContext);
}

export function usePartyAccess(partyId: string): {
  check: AccessCheck | null;
  loading: boolean;
  refresh: () => void;
} {
  const session = useAccessSession();
  const [check, setCheck] = useState<AccessCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!partyId.trim() || !session?.geoAllowed) {
      setCheck(null);
      setLoading(false);
      return;
    }
    // Guard against out-of-order responses when partyId changes quickly.
    let cancelled = false;
    setLoading(true);
    fetchAccessCheck(partyId.trim())
      .then((c) => {
        if (!cancelled) setCheck(c);
      })
      .catch(() => {
        if (cancelled) return;
        setCheck({
          allowed: false,
          geoAllowed: session.geoAllowed,
          countryCode: session.countryCode,
          kycRequired: session.kycRequired,
          kycVerified: false,
          partyAllowlisted: false,
          reason: "Could not verify party access.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partyId, session?.geoAllowed, session?.kycRequired, nonce]);

  return { check, loading, refresh };
}

export function AccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<AccessSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAccessSession()
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch(() => {
        if (!cancelled)
          setLoadError(
            "Could not reach the API. Start the stack with `pnpm all` in the intent-swap directory.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Never let a transient access-API failure block the auth/onboarding pages —
  // otherwise users can't even sign in or submit KYC when the API is down.
  if (isPublicPath(pathname)) {
    return <AccessContext.Provider value={session}>{children}</AccessContext.Provider>;
  }

  if (loadError) {
    return <AccessBlocked title="Service unavailable" message={loadError} />;
  }

  if (!session) {
    return (
      <div className="access-gate-loading">
        <div className="access-spinner" aria-hidden />
        <p>Verifying regional access…</p>
      </div>
    );
  }

  if (!session.geoAllowed) {
    return (
      <AccessBlocked
        title="Access restricted"
        message={
          session.reason ??
          "Canton Network services are not available in your region."
        }
        countryCode={session.countryCode}
      />
    );
  }

  return <AccessContext.Provider value={session}>{children}</AccessContext.Provider>;
}

function AccessBlocked({
  title,
  message,
  countryCode,
}: {
  title: string;
  message: string;
  countryCode?: string | null;
}) {
  return (
    <div className="access-gate-blocked">
      <div className="access-gate-card">
        <span className="access-gate-icon" aria-hidden>
          ⛔
        </span>
        <h1>{title}</h1>
        <p>{message}</p>
        {countryCode ? (
          <p className="access-gate-meta">Detected region: {countryCode}</p>
        ) : null}
        <p className="access-gate-footnote">
          Helvex is available only to approved jurisdictions and KYC-verified Canton parties.
        </p>
      </div>
    </div>
  );
}

export function PartyAccessBanner({
  partyId,
  roleLabel,
}: {
  partyId: string;
  roleLabel: string;
}) {
  const { check, loading } = usePartyAccess(partyId);

  if (loading || !check) return null;

  if (check.allowed) {
    return (
      <div className="access-party-banner access-party-ok">
        {roleLabel} approved · KYC {check.kycRequired ? "verified" : "not required"}
      </div>
    );
  }

  return (
    <div className="access-party-banner access-party-denied" role="alert">
      {check.reason ?? `${roleLabel} not approved for this service.`}
    </div>
  );
}
