"use client";

import type { LoopNetwork } from "./types";

export function isLoopWalletEnabled(): boolean {
  const configured = (process.env.NEXT_PUBLIC_WALLET_PROVIDER ?? "dev").trim().toLowerCase();
  return configured === "loop";
}

export function loopNetworkFromEnv(): LoopNetwork {
  const raw = (process.env.NEXT_PUBLIC_LOOP_NETWORK ?? "devnet").trim().toLowerCase();
  if (raw === "local" || raw === "devnet" || raw === "testnet" || raw === "mainnet") return raw;
  return "devnet";
}

/**
 * How intents are signed. The `loop` verifier resolves the *maker* party's
 * on-ledger public key, but the maker is a validator-hosted (local) trading
 * party whose key the participant holds — a Loop-wallet signature can't be
 * verified against it. Until external-party intent signing is wired, set
 * `NEXT_PUBLIC_INTENT_SIGNATURE_MODE=dev` to emit `dev:` signatures (accepted
 * by the backend's hybrid verifier when NODE_ENV≠production). Loop is still
 * used for wallet connect, deposits, and transfers.
 */
export function intentSignatureMode(): "dev" | "loop" {
  const raw = (process.env.NEXT_PUBLIC_INTENT_SIGNATURE_MODE ?? "").trim().toLowerCase();
  return raw === "dev" ? "dev" : "loop";
}
