import type {
  AccountStatus,
  ApiKeyRecord,
  ApiKeyScope,
  AuditLogEntry,
  DepositRecord,
  DepositStatus,
  ProfileType,
  TradingAccount,
  TransferRecord,
  TransferStatus,
  WithdrawalRecord,
  WithdrawalStatus,
} from "../types.js";

export interface CreateTradingAccountInput {
  userId: string;
  appPartyId: string;
  loopPartyId?: string | null;
}

export interface TradingAccountRepository {
  create(input: CreateTradingAccountInput): Promise<TradingAccount>;
  findById(id: string): Promise<TradingAccount | null>;
  findByUserId(userId: string): Promise<TradingAccount | null>;
  findByAppParty(appPartyId: string): Promise<TradingAccount | null>;
  /** All ACTIVE trading accounts (used for periodic UTXO consolidation). */
  listActive(): Promise<TradingAccount[]>;
  setLoopParty(accountId: string, loopPartyId: string): Promise<void>;
  setStatus(accountId: string, status: AccountStatus): Promise<void>;
  /** Record cumulative sponsored CC granted to the account (new-user traffic). */
  setSponsoredCc(accountId: string, amount: string): Promise<void>;
}

export interface CreateDepositInput {
  accountId: string;
  instrument: string;
  amount: string;
  sourceLoopParty: string;
  idempotencyKey: string;
}

export interface DepositRepository {
  create(input: CreateDepositInput): Promise<DepositRecord>;
  /** Scoped to the owning account so one user can never read another's record. */
  findByIdempotencyKey(accountId: string, key: string): Promise<DepositRecord | null>;
  findById(id: string): Promise<DepositRecord | null>;
  listByAccount(accountId: string): Promise<DepositRecord[]>;
  listByStatus(status: DepositStatus): Promise<DepositRecord[]>;
  setStatus(id: string, status: DepositStatus, ledgerTxId?: string): Promise<void>;
}

export interface CreateWithdrawalInput {
  accountId: string;
  destLoopParty: string;
  instrument: string;
  amount: string;
  idempotencyKey: string;
}

export interface WithdrawalRepository {
  create(input: CreateWithdrawalInput): Promise<WithdrawalRecord>;
  /** Scoped to the owning account so one user can never read another's record. */
  findByIdempotencyKey(accountId: string, key: string): Promise<WithdrawalRecord | null>;
  findById(id: string): Promise<WithdrawalRecord | null>;
  listByAccount(accountId: string): Promise<WithdrawalRecord[]>;
  listByStatus(status: WithdrawalStatus): Promise<WithdrawalRecord[]>;
  setStatus(
    id: string,
    status: WithdrawalStatus,
    extra?: { ledgerTxId?: string; approvedBy?: string; failureReason?: string },
  ): Promise<void>;
  /**
   * Atomic status transition guarded on the current status. Returns false if
   * the row is no longer in `from` (i.e. another worker already claimed it),
   * preventing double-execution of the on-ledger withdrawal.
   */
  setStatusIfCurrent(
    id: string,
    from: WithdrawalStatus,
    to: WithdrawalStatus,
  ): Promise<boolean>;
}

export interface CreateTransferInput {
  senderAccountId: string;
  recipientAccountId: string;
  senderAppParty: string;
  recipientAppParty: string;
  instrument: string;
  amount: string;
  idempotencyKey: string;
}

export interface TransferRepository {
  create(input: CreateTransferInput): Promise<TransferRecord>;
  /** Scoped to the sender account so one user can never read another's record. */
  findByIdempotencyKey(senderAccountId: string, key: string): Promise<TransferRecord | null>;
  findById(id: string): Promise<TransferRecord | null>;
  /** Transfers where the account is sender OR recipient, newest first. */
  listByAccount(accountId: string): Promise<TransferRecord[]>;
  /** Transfers SENT by an account on/after `since` (for daily limit checks). */
  listSentSince(senderAccountId: string, since: Date): Promise<TransferRecord[]>;
  /** All transfers in a given status (used by the stuck-transfer reconciler). */
  listByStatus(status: TransferStatus): Promise<TransferRecord[]>;
  setStatus(
    id: string,
    status: TransferStatus,
    extra?: { ledgerTxId?: string; failureReason?: string },
  ): Promise<void>;
}

export interface CreateApiKeyInput {
  keyId: string;
  accountId: string;
  hashedSecret: string;
  /** AES-256-GCM ciphertext of the secret (see {@link ApiKeyRecord.encryptedSecret}). */
  encryptedSecret: string;
  scopes: ApiKeyScope[];
  rateTier?: string;
  label?: string;
}

export interface ApiKeyRepository {
  create(input: CreateApiKeyInput): Promise<ApiKeyRecord>;
  findByKeyId(keyId: string): Promise<ApiKeyRecord | null>;
  listByAccount(accountId: string): Promise<ApiKeyRecord[]>;
  touchLastUsed(keyId: string): Promise<void>;
  revoke(id: string, accountId: string): Promise<boolean>;
}

export interface AppendAuditInput {
  actor: string;
  action: string;
  params?: Record<string, unknown> | null;
  ip?: string | null;
  result: string;
}

export interface AuditLogRepository {
  append(input: AppendAuditInput): Promise<void>;
  list(limit?: number): Promise<AuditLogEntry[]>;
}

/** Replay-protection store for HMAC-signed API requests. */
export interface NonceStore {
  /** Returns true if the nonce is fresh (and records it); false if already seen. */
  consume(keyId: string, nonce: string, timestampMs: number): Promise<boolean>;
  /** Remove nonces older than the clock-skew window. */
  prune(olderThanMs: number): Promise<void>;
}

export type { ProfileType };
