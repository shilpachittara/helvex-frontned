import { z } from "zod";
import { API_KEY_SCOPES, PAIR_IDS, PROFILE_TYPES } from "./types.js";
const amountString = z
    .string()
    .regex(/^\d+(\.\d+)?$/, "must be a non-negative decimal string");
/** Amount that must be strictly positive (deposits, withdrawals, transfers). */
const positiveAmountString = amountString.refine((v) => Number.parseFloat(v) > 0, "amount must be greater than 0");
const instrumentKey = z.enum(["CC", "CBTC", "USDCX"]);
export const pairIdSchema = z.enum(PAIR_IDS);
export const canonicalIntentPayloadSchema = z.object({
    domain: z.literal("intent-swap/v1"),
    intentId: z.string().min(1).max(128),
    maker: z.string().min(1),
    pair: pairIdSchema,
    sellAmount: z.string().regex(/^\d+(\.\d+)?$/),
    minBuyAmount: z.string().regex(/^\d+(\.\d+)?$/),
    deadline: z.string().datetime(),
    nonce: z.number().int().nonnegative(),
});
export const submitIntentSchema = canonicalIntentPayloadSchema.extend({
    signature: z.string().min(1),
});
export const fillIntentSchema = z.object({
    intentId: z.string().min(1),
    solver: z.string().min(1),
    buyAmount: z
        .string()
        .regex(/^\d+(\.\d+)?$/)
        .refine((v) => Number.parseFloat(v) > 0, "buyAmount must be greater than 0"),
});
// ---------------------------------------------------------------------------
// Deposit-model API schemas
// ---------------------------------------------------------------------------
export const profileTypeSchema = z.enum(PROFILE_TYPES);
export const apiKeyScopeSchema = z.enum(API_KEY_SCOPES);
export const institutionDetailsSchema = z.object({
    legalName: z.string().min(1).max(256),
    jurisdiction: z.string().min(2).max(64),
    expectedMonthlyVolume: z.string().max(64).optional(),
    automatedTrading: z.boolean().optional(),
    sourceOfFunds: z.string().max(512).optional(),
});
export const submitKycSchema = z
    .object({
    email: z.string().email(),
    fullName: z.string().min(1).max(256),
    countryCode: z.string().length(2),
    profileType: profileTypeSchema,
    requestedRole: z.enum(["MAKER", "SOLVER", "BOTH"]),
    institution: institutionDetailsSchema.optional(),
    notes: z.string().max(2000).optional(),
})
    .refine((v) => v.profileType === "INDIVIDUAL" ||
    (v.institution !== undefined && v.institution.legalName.length > 0), { message: "Institution details are required for non-individual profiles.", path: ["institution"] });
export const onboardAccountSchema = z.object({
    loopPartyId: z.string().min(3).optional(),
});
export const prepareDepositSchema = z.object({
    instrument: instrumentKey,
    amount: positiveAmountString,
    idempotencyKey: z.string().min(8).max(128),
});
export const requestWithdrawalSchema = z.object({
    instrument: instrumentKey,
    amount: positiveAmountString,
    idempotencyKey: z.string().min(8).max(128),
});
export const requestTransferSchema = z.object({
    recipientEmail: z.string().email(),
    instrument: instrumentKey,
    amount: positiveAmountString,
    idempotencyKey: z.string().min(8).max(128),
});
export const createApiKeySchema = z.object({
    label: z.string().min(1).max(128).optional(),
    scopes: z.array(apiKeyScopeSchema).min(1),
});
//# sourceMappingURL=schemas.js.map