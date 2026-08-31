import type { CanonicalIntentPayload } from "@intent-swap/domain";
import { canonicalizeIntentPayload, devIntentSignature } from "../signing";
import type { ConnectedWallet, LoopProvider } from "./types";
import { signWithLoop } from "./loop-client";
import { usesSessionIntentSignature } from "./config";

export async function signIntentPayload(
  wallet: ConnectedWallet | null,
  loopProvider: LoopProvider | null,
  payload: CanonicalIntentPayload,
): Promise<string> {
  // Temple custody: trade from the validator-hosted app party without a Loop
  // signature per intent (Loop is deposit/withdraw only).
  if (usesSessionIntentSignature()) {
    return devIntentSignature(payload);
  }
  if (wallet?.kind === "loop") {
    if (!loopProvider) {
      throw new Error("Wallet not connected. Connect Wallet before signing.");
    }
    const message = canonicalizeIntentPayload(payload);
    return signWithLoop(loopProvider, message);
  }

  return devIntentSignature(payload);
}
