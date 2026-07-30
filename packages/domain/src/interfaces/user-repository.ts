export interface UserRecord {
  cantonPartyId: string;
  kycStatus: string;
  countryCode: string | null;
  email: string | null;
}

export interface UserRepository {
  findByPartyId(partyId: string): Promise<UserRecord | null>;
}
