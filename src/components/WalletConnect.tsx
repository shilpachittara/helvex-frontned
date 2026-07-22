"use client";

import { useWallet } from "../lib/wallet/WalletProvider";

function shortParty(partyId: string): string {
  const parts = partyId.split("::");
  if (parts.length !== 2) return `${partyId.slice(0, 10)}…`;
  const hint = parts[0].length > 10 ? `${parts[0].slice(0, 8)}…` : parts[0];
  return `${hint}::${parts[1].slice(0, 6)}…`;
}

export function WalletConnect() {
  const { kind, status, wallet, error, connect, disconnect } = useWallet();

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
      {error && (
        <span className="wallet-error" title={error}>
          {error.length > 48 ? `${error.slice(0, 48)}…` : error}
        </span>
      )}
    </div>
  );
}

export function LoopWalletBanner() {
  const { kind, status, connect, linkMessage } = useWallet();
  if (kind !== "loop" || status === "connected") return null;

  return (
    <div className="alert alert-info loop-wallet-banner">
      <div>
        <strong>Connect your Loop wallet</strong>
        <p>
          Sign in with the same email as your Loop account. Approve the connection in Loop to
          link your wallet and sign intents.
        </p>
        {linkMessage && <p className="field-hint">{linkMessage}</p>}
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
