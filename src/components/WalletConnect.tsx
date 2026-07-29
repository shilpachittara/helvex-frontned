"use client";

/**
 * Header Connect button removed — wallet connect lives in the user dropdown
 * (`UserMenu`). This module keeps a lightweight page hint only (hidden in demo mode).
 */

import { isDemoMode } from "../lib/demo-mode";
import { useWallet } from "../lib/wallet/WalletProvider";

/** Optional page hint when wallet is required but not connected. */
export function LoopWalletBanner() {
  const { kind, status } = useWallet();
  if (isDemoMode() || kind !== "loop" || status === "connected") return null;

  return (
    <div className="alert alert-info loop-wallet-banner">
      <div>
        <strong>Connect your wallet</strong>
        <p>
          Open the account menu (top right) and choose <strong>Connect Wallet</strong>. Sign in with
          the same email as your Loop account, then approve the connection.
        </p>
      </div>
    </div>
  );
}
