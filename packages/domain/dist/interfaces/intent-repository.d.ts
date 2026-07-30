import type { FillIntentInput, IntentRecord, IntentStatus, LockResult, RefundResult, SettleResult, SubmitIntentInput } from "../types.js";
export interface IntentRepository {
    createSubmitted(input: SubmitIntentInput, legs: IntentLegs): Promise<IntentRecord>;
    findByIntentId(intentId: string): Promise<IntentRecord | null>;
    list(filters: IntentListFilters): Promise<IntentRecord[]>;
    updateStatus(intentId: string, status: IntentStatus): Promise<void>;
    markLockPending(intentId: string): Promise<void>;
    markLocked(intentId: string, lock: LockResult): Promise<void>;
    markMatched(intentId: string, solver: string, buyAmount: string): Promise<void>;
    /** Atomic LOCKED → MATCHED if still open and before deadline. Returns false if race lost. */
    markMatchedIfLocked(intentId: string, solver: string, buyAmount: string): Promise<boolean>;
    markSettling(intentId: string): Promise<void>;
    /** Atomic MATCHED → SETTLING claim. Returns false if another worker won the race. */
    markSettlingIfMatched(intentId: string): Promise<boolean>;
    /**
     * Generic atomic status transition guarded on the current status. Returns
     * false if the row is no longer in `from` (another actor already moved it),
     * preventing concurrent operator retries from double-claiming an intent.
     */
    setStatusIfCurrent(intentId: string, from: IntentStatus, to: IntentStatus): Promise<boolean>;
    markSettled(intentId: string, result: SettleResult): Promise<void>;
    markExpired(intentId: string): Promise<void>;
    markRefunding(intentId: string): Promise<void>;
    /** Atomic LOCKED → REFUNDING claim. Returns false if another worker won the race. */
    markRefundingIfLocked(intentId: string): Promise<boolean>;
    markRefunded(intentId: string, result: RefundResult): Promise<void>;
    markCancelled(intentId: string): Promise<void>;
    markFailed(intentId: string, reason: string): Promise<void>;
    /**
     * Hard-delete an intent that never locked on-ledger (and related ledger_commands /
     * quotes). Used when submit→lock fails so the maker UI isn't littered with FAILED rows.
     */
    deleteIfUnlocked(intentId: string): Promise<void>;
    recordCommand(input: LedgerCommandRecord): Promise<void>;
    findCommandById(commandId: string): Promise<LedgerCommandRecord | null>;
    listByStatuses(statuses: IntentStatus[]): Promise<IntentRecord[]>;
}
export interface IntentLegs {
    sellInstrument: string;
    buyInstrument: string;
}
export interface IntentListFilters {
    maker?: string;
    status?: IntentStatus;
    statuses?: IntentStatus[];
}
export interface LedgerCommandRecord {
    intentId: string;
    commandType: "LOCK" | "SETTLE" | "REFUND";
    commandId: string;
    completedAt?: Date;
    completionOffset?: bigint;
    error?: string;
}
export type { FillIntentInput, SubmitIntentInput };
//# sourceMappingURL=intent-repository.d.ts.map