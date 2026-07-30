import type { CanonicalIntentPayload } from "./types.js";
/** Stable JSON serialization for signing and verification. */
export declare function canonicalizeIntentPayload(payload: CanonicalIntentPayload): string;
export declare function hashIntentPayload(payload: CanonicalIntentPayload): string;
export declare function toCanonicalPayload(input: {
    intentId: string;
    maker: string;
    pair: CanonicalIntentPayload["pair"];
    sellAmount: string;
    minBuyAmount: string;
    deadline: string;
    nonce: number;
}): CanonicalIntentPayload;
//# sourceMappingURL=intent-signing.d.ts.map