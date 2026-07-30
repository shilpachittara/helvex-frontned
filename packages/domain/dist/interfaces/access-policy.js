export class DevWhitelistAccessPolicy {
    allowlist;
    constructor(allowlist) {
        this.allowlist = allowlist;
    }
    async canSubmitIntent(maker) {
        const entry = await this.allowlist.findActive(maker);
        return entry?.role === "MAKER" || entry?.role === "BOTH";
    }
    async canFillIntent(solver) {
        const entry = await this.allowlist.findActive(solver);
        return entry?.role === "SOLVER" || entry?.role === "BOTH";
    }
    async assertMaker(maker) {
        if (!(await this.canSubmitIntent(maker))) {
            throw new AccessDeniedError(`Maker not allowlisted: ${maker}`);
        }
    }
    async assertSolver(solver) {
        if (!(await this.canFillIntent(solver))) {
            throw new AccessDeniedError(`Solver not allowlisted: ${solver}`);
        }
    }
}
export class AccessDeniedError extends Error {
    statusCode = 403;
    constructor(message) {
        super(message);
        this.name = "AccessDeniedError";
    }
}
/** Production stub — wire KYC + geo in Phase 2 without changing call sites. */
export class KycGeoAccessPolicy {
    allowlist;
    isCountryAllowed;
    isKycVerified;
    partyCountry;
    constructor(allowlist, isCountryAllowed, isKycVerified, partyCountry) {
        this.allowlist = allowlist;
        this.isCountryAllowed = isCountryAllowed;
        this.isKycVerified = isKycVerified;
        this.partyCountry = partyCountry;
    }
    async assertAccess(partyId, role) {
        const entry = await this.allowlist.findActive(partyId);
        const roleOk = entry?.role === role ||
            entry?.role === "BOTH" ||
            (role === "MAKER" && entry?.role === "MAKER") ||
            (role === "SOLVER" && entry?.role === "SOLVER");
        if (!roleOk)
            throw new AccessDeniedError(`Party not allowlisted: ${partyId}`);
        if (!(await this.isKycVerified(partyId))) {
            throw new AccessDeniedError(`KYC not verified: ${partyId}`);
        }
        const country = await this.partyCountry(partyId);
        if (!country || !this.isCountryAllowed(country)) {
            throw new AccessDeniedError(`Geo not allowed: ${partyId}`);
        }
    }
    canSubmitIntent(maker) {
        return this.assertAccess(maker, "MAKER").then(() => true, () => false);
    }
    canFillIntent(solver) {
        return this.assertAccess(solver, "SOLVER").then(() => true, () => false);
    }
    assertMaker(maker) {
        return this.assertAccess(maker, "MAKER");
    }
    assertSolver(solver) {
        return this.assertAccess(solver, "SOLVER");
    }
}
export class KycAllowlistAccessPolicy {
    allowlist;
    users;
    kycRequired;
    constructor(allowlist, users, kycRequired) {
        this.allowlist = allowlist;
        this.users = users;
        this.kycRequired = kycRequired;
    }
    async assertRole(partyId, role) {
        const entry = await this.allowlist.findActive(partyId);
        const roleOk = entry?.role === role || entry?.role === "BOTH" || (role === "MAKER" && entry?.role === "MAKER");
        if (!roleOk)
            throw new AccessDeniedError(`Party not allowlisted: ${partyId}`);
        if (!this.kycRequired)
            return;
        const user = await this.users.findByPartyId(partyId);
        if (user?.kycStatus !== "VERIFIED") {
            throw new AccessDeniedError(`KYC not verified: ${partyId}`);
        }
    }
    async canSubmitIntent(maker) {
        return this.assertRole(maker, "MAKER").then(() => true, () => false);
    }
    async canFillIntent(solver) {
        return this.assertRole(solver, "SOLVER").then(() => true, () => false);
    }
    assertMaker(maker) {
        return this.assertRole(maker, "MAKER");
    }
    assertSolver(solver) {
        return this.assertRole(solver, "SOLVER");
    }
}
//# sourceMappingURL=access-policy.js.map