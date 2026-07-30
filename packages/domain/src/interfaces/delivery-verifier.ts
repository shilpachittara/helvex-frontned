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

export class CantonOnlyDeliveryVerifier implements DeliveryVerifier {
  async verify(_proof: DeliveryProof | null, context: DeliveryContext): Promise<boolean> {
    if (context.buyChain === "canton") return true;
    throw new Error(
      `Cross-chain delivery verification not configured for chain: ${context.buyChain}`,
    );
  }
}

/** Phase 3: verify Solana/EVM tx before releasing Canton escrow. */
export class ExternalChainDeliveryVerifier implements DeliveryVerifier {
  constructor(
    private readonly cantonVerifier: CantonOnlyDeliveryVerifier,
    private readonly chainVerifiers: Map<string, (proof: DeliveryProof, ctx: DeliveryContext) => Promise<boolean>>,
  ) {}

  async verify(proof: DeliveryProof | null, context: DeliveryContext): Promise<boolean> {
    if (context.buyChain === "canton") {
      return this.cantonVerifier.verify(proof, context);
    }
    if (!proof) return false;
    const verifier = this.chainVerifiers.get(context.buyChain);
    if (!verifier) throw new Error(`No verifier for chain: ${context.buyChain}`);
    return verifier(proof, context);
  }
}
