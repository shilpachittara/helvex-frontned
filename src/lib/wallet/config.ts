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
