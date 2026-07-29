"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // With a server-passed session, status is already authenticated/unauthenticated
  // on the first paint (no loading flicker). Keep a loading shell only when the
  // client still has to resolve the session.
  if (status === "loading") {
    return (
      <div className="auth-loading">
        <div className="access-spinner" aria-hidden />
        <p>Authenticating…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="auth-loading">
        <div className="access-spinner" aria-hidden />
        <p>Redirecting to sign in…</p>
      </div>
    );
  }

  return children;
}
