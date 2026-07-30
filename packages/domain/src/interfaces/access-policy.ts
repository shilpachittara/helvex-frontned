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

export class DevWhitelistAccessPolicy implements AccessPolicy {
  constructor(private readonly allowlist: PartyAllowlistSource) {}

  async canSubmitIntent(maker: string): Promise<boolean> {
    const entry = await this.allowlist.findActive(maker);
    return entry?.role === "MAKER" || entry?.role === "BOTH";
  }

  async canFillIntent(solver: string): Promise<boolean> {
    const entry = await this.allowlist.findActive(solver);
    return entry?.role === "SOLVER" || entry?.role === "BOTH";
  }

  async assertMaker(maker: string): Promise<void> {
    if (!(await this.canSubmitIntent(maker))) {
      throw new AccessDeniedError(`Maker not allowlisted: ${maker}`);
    }
  }

  async assertSolver(solver: string): Promise<void> {
    if (!(await this.canFillIntent(solver))) {
      throw new AccessDeniedError(`Solver not allowlisted: ${solver}`);
    }
  }
}

export class AccessDeniedError extends Error {
  readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/** Production stub — wire KYC + geo in Phase 2 without changing call sites. */
export class KycGeoAccessPolicy implements AccessPolicy {
  constructor(
    private readonly allowlist: PartyAllowlistSource,
    private readonly isCountryAllowed: (countryCode: string) => boolean,
    private readonly isKycVerified: (partyId: string) => Promise<boolean>,
    private readonly partyCountry: (partyId: string) => Promise<string | null>,
  ) {}

  private async assertAccess(partyId: string, role: PartyRole): Promise<void> {
    const entry = await this.allowlist.findActive(partyId);
    const roleOk =
      entry?.role === role ||
      entry?.role === "BOTH" ||
      (role === "MAKER" && entry?.role === "MAKER") ||
      (role === "SOLVER" && entry?.role === "SOLVER");
    if (!roleOk) throw new AccessDeniedError(`Party not allowlisted: ${partyId}`);
    if (!(await this.isKycVerified(partyId))) {
      throw new AccessDeniedError(`KYC not verified: ${partyId}`);
    }
    const country = await this.partyCountry(partyId);
    if (!country || !this.isCountryAllowed(country)) {
      throw new AccessDeniedError(`Geo not allowed: ${partyId}`);
    }
  }

  canSubmitIntent(maker: string): Promise<boolean> {
    return this.assertAccess(maker, "MAKER").then(
      () => true,
      () => false,
    );
  }

  canFillIntent(solver: string): Promise<boolean> {
    return this.assertAccess(solver, "SOLVER").then(
      () => true,
      () => false,
    );
  }

  assertMaker(maker: string): Promise<void> {
    return this.assertAccess(maker, "MAKER");
  }

  assertSolver(solver: string): Promise<void> {
    return this.assertAccess(solver, "SOLVER");
  }
}

export class KycAllowlistAccessPolicy implements AccessPolicy {
  constructor(
    private readonly allowlist: PartyAllowlistSource,
    private readonly users: import("./user-repository.js").UserRepository,
    private readonly kycRequired: boolean,
  ) {}

  private async assertRole(partyId: string, role: PartyRole): Promise<void> {
    const entry = await this.allowlist.findActive(partyId);
    const roleOk =
      entry?.role === role || entry?.role === "BOTH" || (role === "MAKER" && entry?.role === "MAKER");
    if (!roleOk) throw new AccessDeniedError(`Party not allowlisted: ${partyId}`);

    if (!this.kycRequired) return;

    const user = await this.users.findByPartyId(partyId);
    if (user?.kycStatus !== "VERIFIED") {
      throw new AccessDeniedError(`KYC not verified: ${partyId}`);
    }
  }

  async canSubmitIntent(maker: string): Promise<boolean> {
    return this.assertRole(maker, "MAKER").then(
      () => true,
      () => false,
    );
  }

  async canFillIntent(solver: string): Promise<boolean> {
    return this.assertRole(solver, "SOLVER").then(
      () => true,
      () => false,
    );
  }

  assertMaker(maker: string): Promise<void> {
    return this.assertRole(maker, "MAKER");
  }

  assertSolver(solver: string): Promise<void> {
    return this.assertRole(solver, "SOLVER");
  }
}

export type { SubmitIntentInput, FillIntentInput };
