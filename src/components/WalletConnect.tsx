"use client";

import { useWallet } from "../lib/wallet/WalletProvider";

function shortParty(partyId: string): string {
  const parts = partyId.split("::");
  if (parts.length !== 2) return partyId.slice(0, 12) + "…";
  return `${parts[0]}::${parts[1].slice(0, 6)}…`;
}

export function WalletConnect() {
  const { kind, status, wallet, error, linkMessage, connect, disconnect } = useWallet();

  if (kind === "dev") {
    return (
      <span className="wallet-badge wallet-badge-dev" title="Dev signer — no external wallet">
        Dev signer
      </span>
    );
  }

  if (status === "connected" && wallet) {
    return (
      <div className="wallet-connect">
        <button
          type="button"
          className="btn btn-wallet btn-wallet-connected"
          onClick={disconnect}
          title={wallet.partyId}
        >
          <LoopMark />
          <span>{shortParty(wallet.partyId)}</span>
        </button>
        {linkMessage && <span className="wallet-link-hint">{linkMessage}</span>}
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <button
        type="button"
        className="btn btn-wallet btn-wallet-primary"
        onClick={() => void connect()}
        disabled={status === "connecting"}
      >
        {status === "connecting" ? (
          <>
            <span className="spinner spinner-sm" />
            Connecting…
          </>
        ) : (
          <>
            <LoopMark />
            Connect Loop
          </>
        )}
      </button>
      {linkMessage && !error && <span className="wallet-link-hint">{linkMessage}</span>}
      {error && <span className="wallet-error">{error}</span>}
    </div>
  );
}

export function LoopWalletBanner() {
  const { kind, status, connect } = useWallet();
  if (kind !== "loop" || status === "connected") return null;

  return (
    <div className="alert alert-info loop-wallet-banner">
      <div>
        <strong>Connect your Loop wallet</strong>
        <p>
          Sign in with the same email as your Loop account. We link your Canton party ID after you
          approve the connection in Loop — we cannot fetch a wallet address by email alone.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => void connect()}
        disabled={status === "connecting"}
      >
        {status === "connecting" ? "Connecting…" : "Connect Loop"}
      </button>
    </div>
  );
}

function LoopMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
