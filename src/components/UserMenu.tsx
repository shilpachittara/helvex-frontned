"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { isDemoMode, maskEmail } from "../lib/demo-mode";
import { useWallet } from "../lib/wallet/WalletProvider";

function shortParty(partyId: string): string {
  const parts = partyId.split("::");
  if (parts.length !== 2) return `${partyId.slice(0, 10)}…`;
  const hint = parts[0].length > 10 ? `${parts[0].slice(0, 8)}…` : parts[0];
  return `${hint}::${parts[1].slice(0, 6)}…`;
}

export function UserMenu() {
  const { data: session } = useSession();
  const { kind, status, wallet, error, connect, disconnect } = useWallet();
  if (!session?.user) return null;

  const demo = isDemoMode();
  const displayName = demo
    ? maskEmail(session.user.email)
    : (session.user.name ?? session.user.email);
  const initials = demo
    ? "U"
    : (session.user.name?.slice(0, 2).toUpperCase() ??
      session.user.email?.slice(0, 2).toUpperCase() ??
      "U");

  const kycOk = session.user.kycStatus === "VERIFIED";
  const walletConnected = status === "connected" && Boolean(wallet);
  // Demo recordings are account / create / solve only — keep wallet connect out of frame.
  const showWalletControls = !demo && (kind === "loop" || kind === "dev");

  return (
    <div className="user-menu">
      <div className="user-menu-trigger">
        <span className={`user-avatar${walletConnected && !demo ? " wallet-on" : ""}`}>{initials}</span>
        <span className="user-meta">
          <span className="user-name">{displayName}</span>
          <span className={`user-kyc${kycOk ? " verified" : ""}`}>
            {kycOk ? "KYC verified" : "KYC pending"}
          </span>
        </span>
      </div>
      <div className="user-dropdown">
        {session.user.cantonPartyId && !demo && (
          <div className="user-dropdown-row">
            <span className="user-dropdown-label">Canton party</span>
            <code className="user-party">{session.user.cantonPartyId}</code>
          </div>
        )}

        {showWalletControls && (
          <div className="user-dropdown-row user-dropdown-wallet">
            <span className="user-dropdown-label">Wallet</span>
            {kind === "dev" ? (
              <span className="user-wallet-status">Dev signer</span>
            ) : walletConnected && wallet ? (
              <>
                <span
                  className="user-wallet-status connected"
                  title={demo ? "Wallet connected" : wallet.partyId}
                >
                  {demo ? "Connected" : shortParty(wallet.partyId)}
                </span>
                <button
                  type="button"
                  className="user-dropdown-link"
                  onClick={disconnect}
                >
                  Disconnect wallet
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="user-dropdown-link user-connect-wallet"
                  onClick={() => void connect()}
                  disabled={status === "connecting"}
                >
                  {status === "connecting" ? "Connecting…" : "Connect Wallet"}
                </button>
                {error && (
                  <span className="user-wallet-error" title={error}>
                    {demo
                      ? "Allow the wallet popup, then try again"
                      : error.length > 64
                        ? `${error.slice(0, 64)}…`
                        : error}
                  </span>
                )}
              </>
            )}
          </div>
        )}

        <Link href="/" className="user-dropdown-link">
          Trading desk
        </Link>
        <Link href="/solver" className="user-dropdown-link">
          Solver desk
        </Link>
        <button
          type="button"
          className="user-dropdown-link user-signout"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
