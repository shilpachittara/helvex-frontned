import type { PairId } from "../types.js";
/** Proof of delivery on an external chain — populated in Phase 3 (cross-chain). */
export interface DeliveryProof {
    chainId: string;
    txHash: string;
    recipient: string;
    amount: string;
    asset: string;
    confirmations: number;
}
export interface DeliveryVerifier {
    /** Returns true when external delivery is confirmed. Canton-only impl always true. */
    verify(proof: DeliveryProof | null, context: DeliveryContext): Promise<boolean>;
}
export interface DeliveryContext {
    intentId: string;
    pair: PairId;
    buyChain: "canton" | string;
    minBuyAmount: string;
}
export declare class CantonOnlyDeliveryVerifier implements DeliveryVerifier {
    verify(_proof: DeliveryProof | null, context: DeliveryContext): Promise<boolean>;
}
/** Phase 3: verify Solana/EVM tx before releasing Canton escrow. */
export declare class ExternalChainDeliveryVerifier implements DeliveryVerifier {
    private readonly cantonVerifier;
    private readonly chainVerifiers;
    constructor(cantonVerifier: CantonOnlyDeliveryVerifier, chainVerifiers: Map<string, (proof: DeliveryProof, ctx: DeliveryContext) => Promise<boolean>>);
    verify(proof: DeliveryProof | null, context: DeliveryContext): Promise<boolean>;
}
//# sourceMappingURL=delivery-verifier.d.ts.map