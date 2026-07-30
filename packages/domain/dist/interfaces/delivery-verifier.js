export class CantonOnlyDeliveryVerifier {
    async verify(_proof, context) {
        if (context.buyChain === "canton")
            return true;
        throw new Error(`Cross-chain delivery verification not configured for chain: ${context.buyChain}`);
    }
}
/** Phase 3: verify Solana/EVM tx before releasing Canton escrow. */
export class ExternalChainDeliveryVerifier {
    cantonVerifier;
    chainVerifiers;
    constructor(cantonVerifier, chainVerifiers) {
        this.cantonVerifier = cantonVerifier;
        this.chainVerifiers = chainVerifiers;
    }
    async verify(proof, context) {
        if (context.buyChain === "canton") {
            return this.cantonVerifier.verify(proof, context);
        }
        if (!proof)
            return false;
        const verifier = this.chainVerifiers.get(context.buyChain);
        if (!verifier)
            throw new Error(`No verifier for chain: ${context.buyChain}`);
        return verifier(proof, context);
    }
}
//# sourceMappingURL=delivery-verifier.js.map