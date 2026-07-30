import type { FillIntentInput, PartyRole, SubmitIntentInput } from "../types.js";
export interface AccessPolicy {
    canSubmitIntent(maker: string): Promise<boolean>;
    canFillIntent(solver: string): Promise<boolean>;
    assertMaker(maker: string): Promise<void>;
    assertSolver(solver: string): Promise<void>;
}
export interface PartyAllowlistEntry {
    partyId: string;
    role: PartyRole;
    active: boolean;
}
export interface PartyAllowlistSource {
    findActive(partyId: string): Promise<PartyAllowlistEntry | null>;
}
export declare class DevWhitelistAccessPolicy implements AccessPolicy {
    private readonly allowlist;
    constructor(allowlist: PartyAllowlistSource);
    canSubmitIntent(maker: string): Promise<boolean>;
    canFillIntent(solver: string): Promise<boolean>;
    assertMaker(maker: string): Promise<void>;
    assertSolver(solver: string): Promise<void>;
}
export declare class AccessDeniedError extends Error {
    readonly statusCode = 403;
    constructor(message: string);
}
/** Production stub — wire KYC + geo in Phase 2 without changing call sites. */
export declare class KycGeoAccessPolicy implements AccessPolicy {
    private readonly allowlist;
    private readonly isCountryAllowed;
    private readonly isKycVerified;
    private readonly partyCountry;
    constructor(allowlist: PartyAllowlistSource, isCountryAllowed: (countryCode: string) => boolean, isKycVerified: (partyId: string) => Promise<boolean>, partyCountry: (partyId: string) => Promise<string | null>);
    private assertAccess;
    canSubmitIntent(maker: string): Promise<boolean>;
    canFillIntent(solver: string): Promise<boolean>;
    assertMaker(maker: string): Promise<void>;
    assertSolver(solver: string): Promise<void>;
}
export declare class KycAllowlistAccessPolicy implements AccessPolicy {
    private readonly allowlist;
    private readonly users;
    private readonly kycRequired;
    constructor(allowlist: PartyAllowlistSource, users: import("./user-repository.js").UserRepository, kycRequired: boolean);
    private assertRole;
    canSubmitIntent(maker: string): Promise<boolean>;
    canFillIntent(solver: string): Promise<boolean>;
    assertMaker(maker: string): Promise<void>;
    assertSolver(solver: string): Promise<void>;
}
export type { SubmitIntentInput, FillIntentInput };
//# sourceMappingURL=access-policy.d.ts.map