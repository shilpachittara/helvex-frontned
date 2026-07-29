import type { CanonicalIntentPayload } from "@intent-swap/domain";

export type WalletKind = "dev" | "loop";

export type WalletStatus = "disconnected" | "connecting" | "connected";

export interface ConnectedWallet {
  kind: WalletKind;
  partyId: string;
  email?: string;
}

export interface WalletContextValue {
  kind: WalletKind;
  status: WalletStatus;
  wallet: ConnectedWallet | null;
  error: string | null;
  linkMessage: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signIntent: (payload: CanonicalIntentPayload) => Promise<string>;
  /** Transfer from the connected Loop wallet (deposit into the app party). */
  transfer: (input: WalletTransferInput) => Promise<void>;
}

export type LoopNetwork = "local" | "devnet" | "testnet" | "mainnet";

/** Instrument selector understood by the Loop SDK transfer call. */
export interface LoopInstrumentSpec {
  instrument_admin?: string;
  instrument_id: string;
}

/**
 * Loop provider surface used by Intent Swap (deposit model). Method signatures
 * mirror the Loop SDK `Provider` so the connected provider is assignable; only
 * the members the app actually uses are declared.
 */
export interface LoopProvider {
  party_id: string;
  email?: string;
  signMessage(message: string): Promise<unknown>;
  transfer?(
    recipient: string,
    amount: string | number,
    instrument?: LoopInstrumentSpec,
    options?: unknown,
  ): Promise<unknown>;
}

export interface WalletTransferInput {
  to: string;
  amount: string;
  /** UI symbol (CC/CBTC/USDCX) — used only when `loopInstrument` is omitted. */
  instrumentId?: string;
  /** Preferred: ledger instrument selector from `/v1/deposits/prepare`. */
  loopInstrument?: LoopInstrumentSpec;
}
