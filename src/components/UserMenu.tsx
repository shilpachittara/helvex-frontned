"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function UserMenu() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  const initials =
    session.user.name?.slice(0, 2).toUpperCase() ??
    session.user.email?.slice(0, 2).toUpperCase() ??
    "U";

  const kycOk = session.user.kycStatus === "VERIFIED";

  return (
    <div className="user-menu">
      <div className="user-menu-trigger">
        <span className="user-avatar">{initials}</span>
        <span className="user-meta">
          <span className="user-name">{session.user.name ?? session.user.email}</span>
          <span className={`user-kyc${kycOk ? " verified" : ""}`}>
            {kycOk ? "KYC verified" : "KYC pending"}
          </span>
        </span>
      </div>
      <div className="user-dropdown">
        {session.user.cantonPartyId && (
          <div className="user-dropdown-row">
            <span className="user-dropdown-label">Canton party</span>
            <code className="user-party">{session.user.cantonPartyId}</code>
          </div>
        )}
        <Link href="/" className="user-dropdown-link">
          Maker desk
        </Link>
        <Link href="/solver" className="user-dropdown-link">
          Solver desk
        </Link>
        <button type="button" className="user-dropdown-link user-signout" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </button>
      </div>
    </div>
  );
}
