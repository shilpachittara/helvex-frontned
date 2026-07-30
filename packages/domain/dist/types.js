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
];
export const PAIR_IDS = [
    "CBTC_USDCX",
    "USDCX_CBTC",
    "CC_USDCX",
    "USDCX_CC",
    // LocalNet dev pair (CC<->CC) for lock/settle testing without DevNet tokens.
    "CC_CC",
];
// ---------------------------------------------------------------------------
// Temple-style deposit model: accounts, deposits, withdrawals, KYC profiles
// ---------------------------------------------------------------------------
/** KYC profile classification captured at onboarding. */
export const PROFILE_TYPES = ["INDIVIDUAL", "INSTITUTION", "MARKET_MAKER", "LIQUIDITY_PROVIDER"];
export const ACCOUNT_STATUSES = ["ACTIVE", "FROZEN", "CLOSED"];
export const DEPOSIT_STATUSES = ["PENDING", "CONFIRMED", "CREDITED", "FAILED"];
export const WITHDRAWAL_STATUSES = [
    "REQUESTED",
    "APPROVED",
    "SUBMITTED",
    "COMPLETED",
    "REJECTED",
    "FAILED",
];
export const TRANSFER_STATUSES = ["PENDING", "COMPLETED", "FAILED"];
/** API-key capability scopes. */
export const API_KEY_SCOPES = ["read", "maker", "solver", "withdraw", "transfer"];
//# sourceMappingURL=types.js.map