import { createHash } from "node:crypto";
import type { CanonicalIntentPayload } from "./types.js";
import { canonicalIntentPayloadSchema } from "./schemas.js";

/** Stable JSON serialization for signing and verification. */
export function canonicalizeIntentPayload(
  payload: CanonicalIntentPayload,
): string {
  const validated = canonicalIntentPayloadSchema.parse(payload);
  const ordered: CanonicalIntentPayload = {
    domain: validated.domain,
    intentId: validated.intentId,
    maker: validated.maker,
    pair: validated.pair,
    sellAmount: validated.sellAmount,
    minBuyAmount: validated.minBuyAmount,
    deadline: validated.deadline,
    nonce: validated.nonce,
  };
  return JSON.stringify(ordered);
}

export function hashIntentPayload(payload: CanonicalIntentPayload): string {
  return createHash("sha256")
    .update(canonicalizeIntentPayload(payload))
    .digest("hex");
}

export function toCanonicalPayload(input: {
  intentId: string;
  maker: string;
  pair: CanonicalIntentPayload["pair"];
  sellAmount: string;
  minBuyAmount: string;
  deadline: string;
  nonce: number;
}): CanonicalIntentPayload {
  return canonicalIntentPayloadSchema.parse({
    domain: "intent-swap/v1",
    ...input,
  });
}
