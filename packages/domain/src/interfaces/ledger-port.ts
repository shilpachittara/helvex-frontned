import type {
  AppFeeConfig,
  IntentRecord,
  LockResult,
  RefundResult,
  SettleResult,
} from "../types.js";

/** Raw on-ledger total for one instrument (no intent-level locks applied). */
export interface LedgerBalance {
  instrumentId: string;
  symbol: string;
  total: string;
}

export interface TransferInput {
  from: string;
  to: string;
  instrumentId: string;
  amount: string;
  commandId: string;
  /** Optional human-readable reason recorded in transfer metadata. */
  reason?: string;
}

export interface TransferResult {
  ledgerTxId: string;
}

export interface WithdrawalExecutionInput {
  account: string;
  destLoopParty: string;
  instrumentId: string;
  amount: string;
  requestId: string;
  commandId: string;
}

export interface ConsolidateResult {
  /** UTXO count before consolidation. */
  before: number;
  /** UTXO count after consolidation (best-effort). */
  after: number;
  ledgerTxId?: string;
}

/** Pending CIP-0056 inbound transfer waiting for receiver Accept. */
export interface PendingInboundTransfer {
  contractId: string;
  sender: string;
  amount: string;
  instrumentId: string;
  symbol: string;
  executeBefore?: string;
}

export interface AcceptInboundTransfersResult {
  accepted: number;
  failed: Array<{ contractId: string; amount: string; symbol: string; error: string }>;
}

export interface WhitelistInput {
  /** Party to add to the on-ledger operator allowlist (app party or external party). */
  party: string;
  /** KYC tier recorded on the entry (must be non-empty). */
  kycTier: string;
  /** Why the party is approved (e.g. "BOTH" / "EXTERNAL"; must be non-empty). */
  role: string;
  commandId: string;
}

export interface OnboardAccountInput {
  /** The user's self-custody app party (owner of funds while trading). */
  owner: string;
  /** The user's linked external (withdrawal) party. */
  linkedExternalParty: string;
  kycTier: string;
  commandId: string;
}

export interface WithdrawalDelegationInput {
  /** The user's app party — the SIGNATORY of the delegation (self-custody). */
  owner: string;
  /** The single immutable withdrawal destination (the user's external party). */
  linkedExternalParty: string;
  commandId: string;
}

export interface LedgerPort {
  lockIntent(intent: IntentRecord, commandId: string): Promise<LockResult>;
  settleIntent(
    intent: IntentRecord,
    solver: string,
    buyAmount: string,
    commandId: string,
    fee?: AppFeeConfig,
  ): Promise<SettleResult>;
  refundIntent(intent: IntentRecord, commandId: string): Promise<RefundResult>;
  hasSufficientBalance(party: string, instrumentId: string, amount: string): Promise<boolean>;
  /** Total on-ledger balances for a party across all configured instruments. */
  getBalances(party: string): Promise<LedgerBalance[]>;
  /**
   * List pending CIP-0056 TransferInstructions where `party` is the receiver
   * (Loop/faucet deposits waiting for Accept before Holdings appear).
   */
  listInboundTransfers?(party: string): Promise<PendingInboundTransfer[]>;
  /**
   * Accept pending CIP-0056 TransferInstructions for `party`. Until accepted,
   * funds stay locked in the instruction and do not appear as Holdings.
   */
  acceptInboundTransfers?(party: string): Promise<AcceptInboundTransfersResult>;
  /** Move tokens between two parties (used for deposit-sim and withdrawals). */
  transfer(input: TransferInput): Promise<TransferResult>;
  /**
   * Execute a withdrawal: record a destination-locked on-ledger anchor via the
   * user-signed WithdrawalDelegation (WithdrawToExternal) and transfer funds to
   * the linked external party only. Idempotency is enforced in the backend DB.
   */
  executeWithdrawal(input: WithdrawalExecutionInput): Promise<TransferResult>;
  /**
   * Set the on-ledger freeze flag for a party's TradingAccount (compliance /
   * incident response). Optional: off-ledger status is the authoritative gate in
   * Phase 1; the on-ledger SetFrozen is best-effort when a registry exists.
   */
  setAccountFrozen?(party: string, frozen: boolean, commandId: string): Promise<void>;
  /**
   * Ensure the singleton `OperatorRole` contract exists (idempotent bootstrap).
   * Required before any allowlist/onboarding choice can be exercised on-ledger.
   */
  ensureOperatorRole?(commandId: string): Promise<void>;
  /**
   * Add a party to the on-ledger operator allowlist via `OperatorRole.AddToWhitelist`.
   * The contract's `SettleWith` / `WithdrawToExternal` refuse any party without a
   * live `WhitelistEntry`, so app parties MUST be whitelisted before they can trade
   * or withdraw. Idempotent: a duplicate entry for the same party is a no-op.
   */
  addToWhitelist?(input: WhitelistInput): Promise<void>;
  /**
   * Record the on-ledger `TradingAccount` registry row via `OperatorRole.OnboardAccount`
   * (KYC/account metadata + freeze state; does NOT custody funds). Both the owner and
   * the linked external party must already be whitelisted. Idempotent per (operator, owner).
   */
  onboardTradingAccount?(input: OnboardAccountInput): Promise<void>;
  /**
   * Create the user-signed `WithdrawalDelegation` (signatory = owner) that locks
   * the withdrawal destination to `linkedExternalParty` and authorizes the
   * operator to run `WithdrawToExternal`. Without it, `executeWithdrawal` cannot
   * mint the on-ledger destination-locked `WithdrawalReceipt` and falls back to a
   * bare transfer. Keyed `(operator, owner)`, so it MUST be created at most once
   * per account (Canton 3.x keys are non-unique; a duplicate breaks by-key
   * exercise). Idempotent at the call site via onboarding's once-per-account guard.
   */
  createWithdrawalDelegation?(input: WithdrawalDelegationInput): Promise<void>;
  /** Count on-ledger holding UTXOs for a party+instrument (UTXO hygiene). */
  countHoldings?(party: string, instrumentId: string): Promise<number>;
  /**
   * Consolidate many small holding UTXOs into fewer ones (dust hygiene). The
   * validator's MergeDelegation auto-merge is the primary mechanism; this is a
   * best-effort app-level backstop. Must never throw to the caller.
   */
  consolidateHoldings?(
    party: string,
    instrumentId: string,
    commandId: string,
  ): Promise<ConsolidateResult>;
}
