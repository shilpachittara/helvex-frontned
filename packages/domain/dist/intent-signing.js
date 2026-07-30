import { createHash } from "node:crypto";
import { canonicalIntentPayloadSchema } from "./schemas.js";
/** Stable JSON serialization for signing and verification. */
export function canonicalizeIntentPayload(payload) {
    const validated = canonicalIntentPayloadSchema.parse(payload);
    const ordered = {
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
export function hashIntentPayload(payload) {
    return createHash("sha256")
        .update(canonicalizeIntentPayload(payload))
        .digest("hex");
}
export function toCanonicalPayload(input) {
    return canonicalIntentPayloadSchema.parse({
        domain: "intent-swap/v1",
        ...input,
    });
}
//# sourceMappingURL=intent-signing.js.map