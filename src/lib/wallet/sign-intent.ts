import type { CanonicalIntentPayload } from "@intent-swap/domain";
import { canonicalizeIntentPayload, devIntentSignature } from "../signing";
import type { ConnectedWallet, LoopProvider } from "./types";
import { signWithLoop } from "./loop-client";
import { intentSignatureMode } from "./config";

export async function signIntentPayload(
  wallet: ConnectedWallet | null,
  loopProvider: LoopProvider | null,
  payload: CanonicalIntentPayload,
): Promise<string> {
  // Transitional: a Loop-wallet signature is verified against the maker's
  // on-ledger key, but the maker is a validator-hosted local party — so force
  // dev signatures for intents when configured (Loop stays for deposits).
  if (intentSignatureMode() === "dev") {
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
