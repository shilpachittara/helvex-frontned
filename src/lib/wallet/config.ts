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
 * How intents are signed for Temple-style custody trading.
 *
 * - `session` (recommended, TestNet + MainNet): emit a payload integrity hash
 *   (`dev:<sha256>`). Authorization is the login session + maker === app party
 *   on the API. Loop is used only for deposit/withdraw transfers — not per trade
 *   (Loop signatures cost CC gas).
 * - `dev`: legacy alias of `session`.
 * - `loop`: ask the Loop wallet to Ed25519-sign each intent (expensive; only if
 *   the maker party key is held in Loop).
 */
export function intentSignatureMode(): "session" | "dev" | "loop" {
  const raw = (process.env.NEXT_PUBLIC_INTENT_SIGNATURE_MODE ?? "session").trim().toLowerCase();
  if (raw === "loop") return "loop";
  if (raw === "dev") return "dev";
  return "session";
}

/** True when intents use session/dev integrity hashes (no Loop signing). */
export function usesSessionIntentSignature(): boolean {
  return intentSignatureMode() !== "loop";
}
