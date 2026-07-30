export const INTENT_SIGN_DOMAIN = "intent-swap/v1";

export const INTENT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "LOCK_PENDING",
  "LOCKED",
  "MATCHED",
  "SETTLING",
  "SETTLED",
  "EXPIRED",
  "REFUNDING",
  "REFUNDED",
  "CANCELLED",
  "FAILED",
] as const;

export type IntentStatus = (typeof INTENT_STATUSES)[number];

export const PAIR_IDS = [
  "CBTC_USDCX",
  "USDCX_CBTC",
  "CC_USDCX",
  "USDCX_CC",
  // LocalNet dev pair (CC<->CC) for lock/settle testing without DevNet tokens.
  "CC_CC",
] as const;

export type PairId = (typeof PAIR_IDS)[number];

export type PartyRole = "MAKER" | "SOLVER" | "BOTH";

export type LedgerCommandType = "LOCK" | "SETTLE" | "REFUND";

export interface InstrumentConfig {
  instrumentId: string;
  adminParty: string;
  symbol: string;
  decimals: number;
  minAmount: string;
  /** Base URL for CIP-0056 registry HTTP APIs. Optional if resolved via Scan. */
  registryUrl?: string;
}

export interface PairConfig {
  id: PairId;
  sell: keyof InstrumentsMap;
  buy: keyof InstrumentsMap;
}

export interface InstrumentsMap {
  CC: InstrumentConfig;
  CBTC: InstrumentConfig;
  USDCX: InstrumentConfig;
}

export interface NetworkInstrumentsConfig {
  network: string;
  instruments: InstrumentsMap;
  pairs: PairConfig[];
}

export interface CanonicalIntentPayload {
  domain: typeof INTENT_SIGN_DOMAIN;
  intentId: string;
  maker: string;
  pair: PairId;
  sellAmount: string;
  minBuyAmount: string;
  deadline: string;
  nonce: number;
}

export interface SubmitIntentInput {
  intentId: string;
  maker: string;
  pair: PairId;
  sellAmount: string;
  minBuyAmount: string;
  deadline: string;
  nonce: number;
  signature: string;
}

export interface FillIntentInput {
  intentId: string;
  solver: string;
  buyAmount: string;
}

export interface IntentRecord {
  id: string;
  intentId: string;
  makerParty: string;
  pair: PairId;
  sellInstrument: string;
  sellAmount: string;
  buyInstrument: string;
  minBuyAmount: string;
  deadline: Date;
  status: IntentStatus;
  intentPayload: CanonicalIntentPayload;
  signature: string;
  swapRequestCid: string | null;
  allocationCids: Record<string, string> | null;
  winningSolver: string | null;
  fillBuyAmount: string | null;
  ledgerSettleTx: string | null;
  ledgerRefundTx: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LockResult {
  swapRequestCid: string;
  allocationCids: Record<string, string>;
  ledgerTxId: string;
}

export interface SettleResult {
  ledgerTxId: string;
  /** Fee charged by the app (in CC) at settlement, if any. */
  feeCharged?: string;
}

export interface RefundResult {
  ledgerTxId: string;
}

// ---------------------------------------------------------------------------
// Temple-style deposit model: accounts, deposits, withdrawals, KYC profiles
// ---------------------------------------------------------------------------

/** KYC profile classification captured at onboarding. */
export const PROFILE_TYPES = ["INDIVIDUAL", "INSTITUTION", "MARKET_MAKER", "LIQUIDITY_PROVIDER"] as const;
export type ProfileType = (typeof PROFILE_TYPES)[number];

export const ACCOUNT_STATUSES = ["ACTIVE", "FROZEN", "CLOSED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const DEPOSIT_STATUSES = ["PENDING", "CONFIRMED", "CREDITED", "FAILED"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const WITHDRAWAL_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "SUBMITTED",
  "COMPLETED",
  "REJECTED",
  "FAILED",
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const TRANSFER_STATUSES = ["PENDING", "COMPLETED", "FAILED"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/** API-key capability scopes. */
export const API_KEY_SCOPES = ["read", "maker", "solver", "withdraw", "transfer"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

/** A user's trading account: an app party hosted on our validator. */
export interface TradingAccount {
  id: string;
  userId: string;
  appPartyId: string;
  /** Loop party the account deposits from and withdraws to (destination lock). */
  loopPartyId: string | null;
  status: AccountStatus;
  /** Cumulative CC granted to this account as new-user traffic sponsorship. */
  sponsoredCc: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepositRecord {
  id: string;
  accountId: string;
  instrument: string;
  amount: string;
  sourceLoopParty: string;
  ledgerTxId: string | null;
  status: DepositStatus;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WithdrawalRecord {
  id: string;
  accountId: string;
  destLoopParty: string;
  instrument: string;
  amount: string;
  status: WithdrawalStatus;
  ledgerTxId: string | null;
  idempotencyKey: string;
  approvedBy: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * An internal user-to-user transfer between two app parties hosted on our
 * validator. Executed on-ledger as a standard CIP-0056 token transfer; this
 * row is the off-ledger projection, with the ledger as the source of truth.
 */
export interface TransferRecord {
  id: string;
  senderAccountId: string;
  recipientAccountId: string;
  senderAppParty: string;
  recipientAppParty: string;
  instrument: string;
  amount: string;
  status: TransferStatus;
  ledgerTxId: string | null;
  idempotencyKey: string;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Per-profile-type daily limits for internal transfers (risk control). */
export interface TransferTierLimit {
  /** Max amount allowed per single transfer, keyed by token symbol. */
  maxPerTransfer?: Record<string, number>;
  /** Max cumulative amount per UTC day, keyed by token symbol. */
  maxDailyAmount?: Record<string, number>;
  /** Max number of transfers per UTC day. */
  maxDailyCount?: number;
}

export type TransferLimits = Partial<Record<ProfileType, TransferTierLimit>>;

export interface ApiKeyRecord {
  id: string;
  keyId: string;
  accountId: string;
  hashedSecret: string;
  /**
   * AES-256-GCM ciphertext of the key secret, for at-rest storage. The plaintext
   * secret is recovered server-side to recompute the request HMAC, so the secret
   * is NEVER transmitted by clients (they send only the HMAC). Null only for
   * legacy keys minted before this scheme — those must be re-minted.
   */
  encryptedSecret: string | null;
  scopes: ApiKeyScope[];
  rateTier: string;
  label: string | null;
  active: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  params: Record<string, unknown> | null;
  ip: string | null;
  result: string;
  createdAt: Date;
}

/** A token balance for a party (one instrument). */
export interface Balance {
  instrument: string;
  symbol: string;
  total: string;
  /** Amount locked by open intents / pending withdrawals. */
  locked: string;
  available: string;
}

/** Configurable app swap fee, applied at settlement. */
export interface AppFeeConfig {
  /** Fee in basis points of the buy leg (e.g. 30 = 0.30%). */
  bps: number;
  /** Flat fee in CC added per settlement. */
  flatCc: string;
  /** Party that collects the fee (our validator's fee party). */
  feeCollector: string;
}
