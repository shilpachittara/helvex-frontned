import type { CanonicalIntentPayload } from "@intent-swap/domain";
import { canonicalizeIntentPayload, devIntentSignature } from "../signing";
import type { ConnectedWallet, LoopProvider } from "./types";
import { signWithLoop } from "./loop-client";

export async function signIntentPayload(
  wallet: ConnectedWallet | null,
  loopProvider: LoopProvider | null,
  payload: CanonicalIntentPayload,
): Promise<string> {
  if (wallet?.kind === "loop") {
    if (!loopProvider) {
      throw new Error("Loop wallet not connected. Connect Loop before signing.");
    }
    const message = canonicalizeIntentPayload(payload);
    return signWithLoop(loopProvider, message);
  }

  return devIntentSignature(payload);
}
