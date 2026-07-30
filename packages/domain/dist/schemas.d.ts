import { z } from "zod";
export declare const pairIdSchema: z.ZodEnum<["CBTC_USDCX", "USDCX_CBTC", "CC_USDCX", "USDCX_CC", "CC_CC"]>;
export declare const canonicalIntentPayloadSchema: z.ZodObject<{
    domain: z.ZodLiteral<"intent-swap/v1">;
    intentId: z.ZodString;
    maker: z.ZodString;
    pair: z.ZodEnum<["CBTC_USDCX", "USDCX_CBTC", "CC_USDCX", "USDCX_CC", "CC_CC"]>;
    sellAmount: z.ZodString;
    minBuyAmount: z.ZodString;
    deadline: z.ZodString;
    nonce: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    maker: string;
    domain: "intent-swap/v1";
    intentId: string;
    pair: "CBTC_USDCX" | "USDCX_CBTC" | "CC_USDCX" | "USDCX_CC" | "CC_CC";
    sellAmount: string;
    minBuyAmount: string;
    deadline: string;
    nonce: number;
}, {
    maker: string;
    domain: "intent-swap/v1";
    intentId: string;
    pair: "CBTC_USDCX" | "USDCX_CBTC" | "CC_USDCX" | "USDCX_CC" | "CC_CC";
    sellAmount: string;
    minBuyAmount: string;
    deadline: string;
    nonce: number;
}>;
export declare const submitIntentSchema: z.ZodObject<{
    domain: z.ZodLiteral<"intent-swap/v1">;
    intentId: z.ZodString;
    maker: z.ZodString;
    pair: z.ZodEnum<["CBTC_USDCX", "USDCX_CBTC", "CC_USDCX", "USDCX_CC", "CC_CC"]>;
    sellAmount: z.ZodString;
    minBuyAmount: z.ZodString;
    deadline: z.ZodString;
    nonce: z.ZodNumber;
} & {
    signature: z.ZodString;
}, "strip", z.ZodTypeAny, {
    maker: string;
    domain: "intent-swap/v1";
    intentId: string;
    pair: "CBTC_USDCX" | "USDCX_CBTC" | "CC_USDCX" | "USDCX_CC" | "CC_CC";
    sellAmount: string;
    minBuyAmount: string;
    deadline: string;
    nonce: number;
    signature: string;
}, {
    maker: string;
    domain: "intent-swap/v1";
    intentId: string;
    pair: "CBTC_USDCX" | "USDCX_CBTC" | "CC_USDCX" | "USDCX_CC" | "CC_CC";
    sellAmount: string;
    minBuyAmount: string;
    deadline: string;
    nonce: number;
    signature: string;
}>;
export declare const fillIntentSchema: z.ZodObject<{
    intentId: z.ZodString;
    solver: z.ZodString;
    buyAmount: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    solver: string;
    intentId: string;
    buyAmount: string;
}, {
    solver: string;
    intentId: string;
    buyAmount: string;
}>;
export type SubmitIntentDto = z.infer<typeof submitIntentSchema>;
export type FillIntentDto = z.infer<typeof fillIntentSchema>;
export declare const profileTypeSchema: z.ZodEnum<["INDIVIDUAL", "INSTITUTION", "MARKET_MAKER", "LIQUIDITY_PROVIDER"]>;
export declare const apiKeyScopeSchema: z.ZodEnum<["read", "maker", "solver", "withdraw", "transfer"]>;
export declare const institutionDetailsSchema: z.ZodObject<{
    legalName: z.ZodString;
    jurisdiction: z.ZodString;
    expectedMonthlyVolume: z.ZodOptional<z.ZodString>;
    automatedTrading: z.ZodOptional<z.ZodBoolean>;
    sourceOfFunds: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    legalName: string;
    jurisdiction: string;
    expectedMonthlyVolume?: string | undefined;
    automatedTrading?: boolean | undefined;
    sourceOfFunds?: string | undefined;
}, {
    legalName: string;
    jurisdiction: string;
    expectedMonthlyVolume?: string | undefined;
    automatedTrading?: boolean | undefined;
    sourceOfFunds?: string | undefined;
}>;
export type InstitutionDetailsDto = z.infer<typeof institutionDetailsSchema>;
export declare const submitKycSchema: z.ZodEffects<z.ZodObject<{
    email: z.ZodString;
    fullName: z.ZodString;
    countryCode: z.ZodString;
    profileType: z.ZodEnum<["INDIVIDUAL", "INSTITUTION", "MARKET_MAKER", "LIQUIDITY_PROVIDER"]>;
    requestedRole: z.ZodEnum<["MAKER", "SOLVER", "BOTH"]>;
    institution: z.ZodOptional<z.ZodObject<{
        legalName: z.ZodString;
        jurisdiction: z.ZodString;
        expectedMonthlyVolume: z.ZodOptional<z.ZodString>;
        automatedTrading: z.ZodOptional<z.ZodBoolean>;
        sourceOfFunds: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        legalName: string;
        jurisdiction: string;
        expectedMonthlyVolume?: string | undefined;
        automatedTrading?: boolean | undefined;
        sourceOfFunds?: string | undefined;
    }, {
        legalName: string;
        jurisdiction: string;
        expectedMonthlyVolume?: string | undefined;
        automatedTrading?: boolean | undefined;
        sourceOfFunds?: string | undefined;
    }>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    fullName: string;
    countryCode: string;
    profileType: "INDIVIDUAL" | "INSTITUTION" | "MARKET_MAKER" | "LIQUIDITY_PROVIDER";
    requestedRole: "MAKER" | "SOLVER" | "BOTH";
    institution?: {
        legalName: string;
        jurisdiction: string;
        expectedMonthlyVolume?: string | undefined;
        automatedTrading?: boolean | undefined;
        sourceOfFunds?: string | undefined;
    } | undefined;
    notes?: string | undefined;
}, {
    email: string;
    fullName: string;
    countryCode: string;
    profileType: "INDIVIDUAL" | "INSTITUTION" | "MARKET_MAKER" | "LIQUIDITY_PROVIDER";
    requestedRole: "MAKER" | "SOLVER" | "BOTH";
    institution?: {
        legalName: string;
        jurisdiction: string;
        expectedMonthlyVolume?: string | undefined;
        automatedTrading?: boolean | undefined;
        sourceOfFunds?: string | undefined;
    } | undefined;
    notes?: string | undefined;
}>, {
    email: string;
    fullName: string;
    countryCode: string;
    profileType: "INDIVIDUAL" | "INSTITUTION" | "MARKET_MAKER" | "LIQUIDITY_PROVIDER";
    requestedRole: "MAKER" | "SOLVER" | "BOTH";
    institution?: {
        legalName: string;
        jurisdiction: string;
        expectedMonthlyVolume?: string | undefined;
        automatedTrading?: boolean | undefined;
        sourceOfFunds?: string | undefined;
    } | undefined;
    notes?: string | undefined;
}, {
    email: string;
    fullName: string;
    countryCode: string;
    profileType: "INDIVIDUAL" | "INSTITUTION" | "MARKET_MAKER" | "LIQUIDITY_PROVIDER";
    requestedRole: "MAKER" | "SOLVER" | "BOTH";
    institution?: {
        legalName: string;
        jurisdiction: string;
        expectedMonthlyVolume?: string | undefined;
        automatedTrading?: boolean | undefined;
        sourceOfFunds?: string | undefined;
    } | undefined;
    notes?: string | undefined;
}>;
export type SubmitKycDto = z.infer<typeof submitKycSchema>;
export declare const onboardAccountSchema: z.ZodObject<{
    loopPartyId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    loopPartyId?: string | undefined;
}, {
    loopPartyId?: string | undefined;
}>;
export type OnboardAccountDto = z.infer<typeof onboardAccountSchema>;
export declare const prepareDepositSchema: z.ZodObject<{
    instrument: z.ZodEnum<["CC", "CBTC", "USDCX"]>;
    amount: z.ZodEffects<z.ZodString, string, string>;
    idempotencyKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    instrument: "CC" | "CBTC" | "USDCX";
    amount: string;
    idempotencyKey: string;
}, {
    instrument: "CC" | "CBTC" | "USDCX";
    amount: string;
    idempotencyKey: string;
}>;
export type PrepareDepositDto = z.infer<typeof prepareDepositSchema>;
export declare const requestWithdrawalSchema: z.ZodObject<{
    instrument: z.ZodEnum<["CC", "CBTC", "USDCX"]>;
    amount: z.ZodEffects<z.ZodString, string, string>;
    idempotencyKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    instrument: "CC" | "CBTC" | "USDCX";
    amount: string;
    idempotencyKey: string;
}, {
    instrument: "CC" | "CBTC" | "USDCX";
    amount: string;
    idempotencyKey: string;
}>;
export type RequestWithdrawalDto = z.infer<typeof requestWithdrawalSchema>;
export declare const requestTransferSchema: z.ZodObject<{
    recipientEmail: z.ZodString;
    instrument: z.ZodEnum<["CC", "CBTC", "USDCX"]>;
    amount: z.ZodEffects<z.ZodString, string, string>;
    idempotencyKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    instrument: "CC" | "CBTC" | "USDCX";
    amount: string;
    idempotencyKey: string;
    recipientEmail: string;
}, {
    instrument: "CC" | "CBTC" | "USDCX";
    amount: string;
    idempotencyKey: string;
    recipientEmail: string;
}>;
export type RequestTransferDto = z.infer<typeof requestTransferSchema>;
export declare const createApiKeySchema: z.ZodObject<{
    label: z.ZodOptional<z.ZodString>;
    scopes: z.ZodArray<z.ZodEnum<["read", "maker", "solver", "withdraw", "transfer"]>, "many">;
}, "strip", z.ZodTypeAny, {
    scopes: ("read" | "maker" | "solver" | "withdraw" | "transfer")[];
    label?: string | undefined;
}, {
    scopes: ("read" | "maker" | "solver" | "withdraw" | "transfer")[];
    label?: string | undefined;
}>;
export type CreateApiKeyDto = z.infer<typeof createApiKeySchema>;
//# sourceMappingURL=schemas.d.ts.map