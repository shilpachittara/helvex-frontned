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

  if (status === "loading") {
    return (
      <div className="auth-loading">
        <div className="access-spinner" aria-hidden />
        <p>Authenticating…</p>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return children;
}
