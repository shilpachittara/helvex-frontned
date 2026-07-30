/**
 * Allocates and configures local parties hosted on our validator.
 *
 * Each user's trading account is backed by a dedicated app party. On
 * provisioning we also set up UTXO hygiene (MergeDelegation) and traffic so the
 * party can trade without per-action operator intervention.
 */
export interface PartyProvisioningPort {
  /** Allocate a new local party hosted on our validator; returns its party id. */
  allocateParty(hint: string): Promise<string>;
  /** Idempotent post-allocation setup (MergeDelegation, traffic top-up grant). */
  setupTradingParty(appPartyId: string): Promise<void>;
  /**
   * Ensure the Ledger API user can actAs/readAs this party (needed after JSON
   * API allocate when validator-admin onboarding was unavailable).
   */
  ensureLedgerRights?(appPartyId: string): Promise<void>;
}
