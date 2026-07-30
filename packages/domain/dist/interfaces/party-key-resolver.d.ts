/**
 * Resolves the Ed25519 signing public key for a Canton party (e.g. via the
 * Ledger API party/topology lookup). Returns base64 or hex of the raw 32-byte
 * key, or a full SPKI PEM. Returns null if the key cannot be found.
 */
export interface PartyKeyResolver {
    getPublicKey(party: string): Promise<string | null>;
}
//# sourceMappingURL=party-key-resolver.d.ts.map