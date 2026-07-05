"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { UserMenu } from "./UserMenu";
import { WalletConnect } from "./WalletConnect";

function networkLabel(): string {
  const network = process.env.NEXT_PUBLIC_CANTON_NETWORK ?? "devnet";
  if (network === "localnet") return "Canton LocalNet";
  if (network === "testnet") return "Canton TestNet";
  if (network === "mainnet") return "Canton MainNet";
  return "Canton DevNet";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isSolver = pathname.startsWith("/solver");
  const isAccount = pathname.startsWith("/account");
  const isMaker = !isSolver && !isAccount;

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" aria-hidden />
      <div className="ambient ambient-b" aria-hidden />
      <div className="grid-overlay" aria-hidden />

      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/" className="brand">
            <span className="brand-mark">IS</span>
            <span className="brand-text">
              Intent Swap
              <span className="brand-tag">Protocol</span>
            </span>
          </Link>

          <nav className="app-nav" aria-label="Main">
            <Link href="/" className={`nav-link${isMaker ? " active" : ""}`}>
              <NavIconSwap />
              Create intent
            </Link>
            <Link href="/solver" className={`nav-link${isSolver ? " active" : ""}`}>
              <NavIconSolver />
              Solver desk
            </Link>
            <Link href="/account" className={`nav-link${isAccount ? " active" : ""}`}>
              <NavIconAccount />
              Account
            </Link>
          </nav>

          <div className="header-actions">
            <span className="network-badge">
              <span className="network-dot pulse" />
              {networkLabel()}
            </span>
            <WalletConnect />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        <div className="footer-inner">
          <span>Permissioned RFQ · Atomic DvP</span>
          <span className="footer-sep">·</span>
          <span>CBTC / USDCx / CC</span>
          <span className="footer-sep">·</span>
          <span className="footer-muted">SOC2 · Geo-restricted · KYC required</span>
        </div>
      </footer>
    </div>
  );
}

function NavIconSwap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12m0 0 4-4m-4 4-4-4" />
    </svg>
  );
}

function NavIconSolver() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function NavIconAccount() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </svg>
  );
}
