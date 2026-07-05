import type { CanonicalIntentPayload, PairId } from "@intent-swap/domain";

/** Browser-safe canonical JSON (matches @intent-swap/domain intent-signing). */
export function canonicalizeIntentPayload(payload: CanonicalIntentPayload): string {
  const ordered: CanonicalIntentPayload = {
    domain: payload.domain,
    intentId: payload.intentId,
    maker: payload.maker,
    pair: payload.pair,
    sellAmount: payload.sellAmount,
    minBuyAmount: payload.minBuyAmount,
    deadline: payload.deadline,
    nonce: payload.nonce,
  };
  return JSON.stringify(ordered);
}

export async function devIntentSignature(payload: CanonicalIntentPayload): Promise<string> {
  const data = new TextEncoder().encode(canonicalizeIntentPayload(payload));
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `dev:${hex}`;
}

export type { PairId };
