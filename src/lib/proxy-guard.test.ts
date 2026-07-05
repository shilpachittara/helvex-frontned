import { describe, expect, it } from "vitest";
import { hasTraversal, isBlockedProxyPath } from "./proxy-guard";

describe("isBlockedProxyPath", () => {
  it("blocks operator/dev/auth backchannel paths", () => {
    expect(isBlockedProxyPath("/v1/auth/login")).toBe(true);
    expect(isBlockedProxyPath("/v1/auth/link-google")).toBe(true);
    expect(isBlockedProxyPath("/internal/retry-settlement")).toBe(true);
    expect(isBlockedProxyPath("/v1/admin/accounts/freeze")).toBe(true);
    expect(isBlockedProxyPath("/v1/dev/simulate-deposit")).toBe(true);
  });

  it("allows normal browser-facing paths", () => {
    expect(isBlockedProxyPath("/v1/intents")).toBe(false);
    expect(isBlockedProxyPath("/v1/quote")).toBe(false);
    expect(isBlockedProxyPath("/v1/solver/fill")).toBe(false);
    expect(isBlockedProxyPath("/v1/balances")).toBe(false);
  });
});

describe("hasTraversal", () => {
  it("rejects dot segments and smuggled separators", () => {
    expect(hasTraversal("/v1/x/../admin/y")).toBe(true);
    expect(hasTraversal("/v1/./x")).toBe(true);
    // %2f decodes to '/', %5c to '\\' — both smuggle a separator inside a segment.
    expect(hasTraversal("/v1/x%2f..%2fadmin")).toBe(true);
    expect(hasTraversal("/v1/x%5cadmin")).toBe(true);
  });

  it("rejects malformed percent-encoding", () => {
    expect(hasTraversal("/v1/%zz")).toBe(true);
  });

  it("accepts clean paths", () => {
    expect(hasTraversal("/v1/intents")).toBe(false);
    expect(hasTraversal("/v1/keys/abc-123")).toBe(false);
    expect(hasTraversal("/v1/wallet/profile")).toBe(false);
  });

  it("a traversal that would normalize into /v1/admin is caught before proxying", () => {
    const path = "/v1/x/../admin/accounts/freeze";
    // Un-normalized, the block check alone would pass; traversal catches it.
    expect(isBlockedProxyPath(path)).toBe(false);
    expect(hasTraversal(path)).toBe(true);
  });
});
