/** Browser calls same-origin `/api/*` — proxied to the Hono backend (no CORS issues). */
const API_BASE = "/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE}${normalized}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  return parseJsonBody<T>(res);
}

/** Parse a JSON body, tolerating empty/no-content (204) responses. */
async function parseJsonBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/**
 * Operator admin routes. The gated `/api/admin/*` proxy REQUIRES the operator's
 * admin key (verified server-side, constant-time) before it will forward to the
 * privileged `/v1/admin/*` backend — so no admin function is reachable from the
 * UI without it. The key is held only in memory by the admin page and sent per
 * request; it is never persisted in the browser.
 */
async function apiAdmin<T>(path: string, adminKey: string, init?: RequestInit): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE}/admin${normalized}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  return parseJsonBody<T>(res);
}

export { API_BASE as API_URL };

export interface AccessSession {
  allowed: boolean;
  geoAllowed: boolean;
  countryCode: string | null;
  reason?: string;
  kycRequired: boolean;
}

export interface AccessCheck extends AccessSession {
  partyId?: string;
  kycVerified: boolean;
  partyAllowlisted: boolean;
}

export async function fetchAccessSession(): Promise<AccessSession> {
  return api<AccessSession>("/v1/access/session");
}

export async function fetchAccessCheck(partyId: string): Promise<AccessCheck> {
  return api<AccessCheck>(`/v1/access/check?partyId=${encodeURIComponent(partyId)}`);
}

export async function linkLoopWallet(input: {
  email: string;
  cantonPartyId: string;
  loopEmail: string;
}): Promise<{ email: string; cantonPartyId: string | null; name: string | null }> {
  return api("/v1/auth/link-loop-wallet", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface WalletProfile {
  email: string;
  cantonPartyId: string | null;
  appPartyId: string | null;
  loopPartyId: string | null;
  linked: boolean;
  sponsoredCc?: string;
  accountStatus?: "ACTIVE" | "FROZEN" | "CLOSED" | null;
}

export async function fetchWalletProfile(email: string): Promise<WalletProfile> {
  return api<WalletProfile>(`/v1/wallet/profile?email=${encodeURIComponent(email)}`);
}

// ---------------------------------------------------------------------------
// Deposit-model: accounts, balances, deposits, withdrawals, API keys
// ---------------------------------------------------------------------------

/** Header that binds a request to the caller's app (trading) party. */
export function partyHeaders(appParty: string): Record<string, string> {
  return { "x-account-party": appParty };
}

export type Instrument = "CC" | "CBTC" | "USDCX";
export type ProfileType = "INDIVIDUAL" | "INSTITUTION" | "MARKET_MAKER" | "LIQUIDITY_PROVIDER";
export type ApiKeyScope = "read" | "maker" | "solver" | "withdraw" | "transfer";

export interface TradingAccountView {
  id: string;
  appPartyId: string;
  loopPartyId: string | null;
  status: "ACTIVE" | "FROZEN" | "CLOSED";
  sponsoredCc?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceView {
  instrument: string;
  symbol: string;
  total: string;
  locked: string;
  available: string;
}

export interface DepositView {
  id: string;
  accountId: string;
  instrument: string;
  amount: string;
  sourceLoopParty: string | null;
  ledgerTxId: string | null;
  status: "PENDING" | "CONFIRMED" | "CREDITED" | "FAILED";
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalView {
  id: string;
  accountId: string;
  destLoopParty: string;
  instrument: string;
  amount: string;
  status: string;
  ledgerTxId: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferView {
  id: string;
  senderAccountId: string;
  recipientAccountId: string;
  senderAppParty: string;
  recipientAppParty: string;
  instrument: string;
  amount: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  ledgerTxId: string | null;
  idempotencyKey: string;
  failureReason: string | null;
  direction?: "IN" | "OUT";
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyView {
  id: string;
  keyId: string;
  scopes: ApiKeyScope[];
  rateTier: string | null;
  label: string | null;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function onboardAccount(
  email: string,
  loopPartyId?: string,
): Promise<{ account: TradingAccountView }> {
  return api("/v1/accounts/onboard", {
    method: "POST",
    headers: { "x-account-email": email },
    body: JSON.stringify(loopPartyId ? { loopPartyId } : {}),
  });
}

export async function fetchBalances(appParty: string): Promise<{ balances: BalanceView[] }> {
  return api("/v1/balances", { headers: partyHeaders(appParty) });
}

export async function prepareDeposit(
  appParty: string,
  body: { instrument: Instrument; amount: string; idempotencyKey: string },
): Promise<{ deposit: DepositView; depositTo: string }> {
  return api("/v1/deposits/prepare", {
    method: "POST",
    headers: partyHeaders(appParty),
    body: JSON.stringify(body),
  });
}

export async function listDeposits(appParty: string): Promise<{ deposits: DepositView[] }> {
  return api("/v1/deposits", { headers: partyHeaders(appParty) });
}

export interface PendingInboundDeposit {
  contractId: string;
  sender: string;
  amount: string;
  instrumentId: string;
  symbol: string;
  executeBefore?: string;
}

export interface AcceptPendingDepositsResult {
  accepted: number;
  failed: Array<{ contractId: string; amount: string; symbol: string; error: string }>;
}

export async function listPendingDeposits(
  appParty: string,
): Promise<{ pending: PendingInboundDeposit[] }> {
  return api("/v1/deposits/pending", { headers: partyHeaders(appParty) });
}

export async function acceptPendingDeposits(
  appParty: string,
): Promise<AcceptPendingDepositsResult> {
  return api("/v1/deposits/accept-pending", {
    method: "POST",
    headers: partyHeaders(appParty),
  });
}

export async function requestWithdrawal(
  appParty: string,
  body: { instrument: Instrument; amount: string; idempotencyKey: string },
): Promise<{ withdrawal: WithdrawalView }> {
  return api("/v1/withdrawals", {
    method: "POST",
    headers: partyHeaders(appParty),
    body: JSON.stringify(body),
  });
}

export async function listWithdrawals(appParty: string): Promise<{ withdrawals: WithdrawalView[] }> {
  return api("/v1/withdrawals", { headers: partyHeaders(appParty) });
}

export async function sendTransfer(
  appParty: string,
  body: { recipientEmail: string; instrument: Instrument; amount: string; idempotencyKey: string },
): Promise<{ transfer: TransferView }> {
  return api("/v1/transfers", {
    method: "POST",
    headers: partyHeaders(appParty),
    body: JSON.stringify(body),
  });
}

export async function listTransfers(appParty: string): Promise<{ transfers: TransferView[] }> {
  return api("/v1/transfers", { headers: partyHeaders(appParty) });
}

export async function createApiKey(
  appParty: string,
  body: { label?: string; scopes: ApiKeyScope[]; rateTier?: "default" | "market_maker" },
): Promise<{ keyId: string; secret: string; scopes: ApiKeyScope[] }> {
  return api("/v1/keys", {
    method: "POST",
    headers: partyHeaders(appParty),
    body: JSON.stringify(body),
  });
}

export async function listApiKeys(appParty: string): Promise<{ keys: ApiKeyView[] }> {
  return api("/v1/keys", { headers: partyHeaders(appParty) });
}

/**
 * Cancel an open maker intent. Intents are signed and cannot be edited — to
 * change terms, cancel and submit a new one. Requires the caller's `maker`
 * scope (same as submitting); cancelling returns the maker's locked funds.
 */
export async function cancelIntent(
  appParty: string,
  intentId: string,
): Promise<{ intent: { intentId: string; status: string } }> {
  return api(`/v1/intents/${encodeURIComponent(intentId)}/cancel`, {
    method: "POST",
    headers: partyHeaders(appParty),
  });
}

export async function revokeApiKey(appParty: string, id: string): Promise<{ ok: boolean }> {
  return api(`/v1/keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: partyHeaders(appParty),
  });
}

export interface QuoteView {
  pair: string;
  sellInstrument: string;
  buyInstrument: string;
  sellAmount: string;
  rate: string;
  notionalUsd: string;
  estReceive: string;
  feeBps: number;
  feeAmount: string;
  minReceive: string;
  priceSources: Record<string, string>;
  expiresAt: string;
  ttlSeconds: number;
  minNotionalUsd: number;
  maxNotionalUsd: number;
  withinLimits: boolean;
}

/** Indicative price quote (v1: firm quote + instant settle). */
export async function fetchQuote(pair: string, amount: string): Promise<QuoteView> {
  return api<QuoteView>(
    `/v1/quote?pair=${encodeURIComponent(pair)}&amount=${encodeURIComponent(amount)}`,
  );
}

/** Admin: freeze or unfreeze (block) a trading account. Requires the operator admin key. */
export async function freezeAccount(
  adminKey: string,
  appParty: string,
  frozen: boolean,
): Promise<{ account: TradingAccountView }> {
  return apiAdmin("/accounts/freeze", adminKey, {
    method: "POST",
    body: JSON.stringify({ appParty, frozen }),
  });
}

export async function fetchKycStatus(email: string): Promise<KycAccountStatus> {
  return api<KycAccountStatus>(`/v1/kyc/status?email=${encodeURIComponent(email)}`);
}

export interface KycAccountStatus {
  requestStatus: "SUBMITTED" | "APPROVED" | "REJECTED" | null;
  kycStatus: string | null;
  canSetupPassword: boolean;
  canLogin: boolean;
}

export interface InstitutionDetailsInput {
  legalName: string;
  jurisdiction: string;
  expectedMonthlyVolume?: string;
  automatedTrading?: boolean;
  sourceOfFunds?: string;
}

export interface KycRequestView {
  id: string;
  email: string;
  fullName: string;
  countryCode: string;
  profileType: ProfileType | null;
  institution: string | null;
  requestedRole: string;
  notes: string | null;
  status: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  /** Latest Didit verdict, when identity verification is configured. */
  diditStatus: string | null;
  diditSessionId: string | null;
  createdAt: string;
}

export async function submitKycRequest(body: {
  email: string;
  fullName: string;
  countryCode: string;
  profileType: ProfileType;
  requestedRole: "MAKER" | "SOLVER" | "BOTH";
  institution?: InstitutionDetailsInput;
  notes?: string;
}): Promise<{ request: KycRequestView; verificationUrl: string | null }> {
  return api("/v1/kyc/requests", { method: "POST", body: JSON.stringify(body) });
}

export async function setupPassword(body: {
  email: string;
  token: string;
  password: string;
}): Promise<{ ok: boolean }> {
  return api("/v1/auth/setup-password", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchAdminKycRequests(
  adminKey: string,
  status?: "SUBMITTED" | "APPROVED" | "REJECTED",
): Promise<{ requests: KycRequestView[] }> {
  const q = status ? `?status=${status}` : "";
  return apiAdmin(`/kyc/requests${q}`, adminKey);
}

export async function approveKycRequest(
  adminKey: string,
  id: string,
  body: { cantonPartyId?: string; role?: "MAKER" | "SOLVER" | "BOTH"; reviewNotes?: string },
): Promise<{ ok: boolean; email: string; setupToken: string; setupUrl: string }> {
  return apiAdmin(`/kyc/requests/${id}/approve`, adminKey, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function rejectKycRequest(
  adminKey: string,
  id: string,
  reviewNotes?: string,
): Promise<{ ok: boolean }> {
  return apiAdmin(`/kyc/requests/${id}/reject`, adminKey, {
    method: "POST",
    body: JSON.stringify({ reviewNotes }),
  });
}
