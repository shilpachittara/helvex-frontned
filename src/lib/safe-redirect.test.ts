import { describe, expect, it } from "vitest";
import { safeCallback } from "./safe-redirect";

const origin = "https://app.example.com";

describe("safeCallback (open-redirect guard)", () => {
  it("allows same-origin path-relative redirects", () => {
    expect(safeCallback("/account", origin)).toBe("/account");
    expect(safeCallback("/solver?tab=open", origin)).toBe("/solver?tab=open");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeCallback("https://evil.example", origin)).toBe("/");
    expect(safeCallback("//evil.example", origin)).toBe("/");
    expect(safeCallback("http://evil.example/path", origin)).toBe("/");
  });

  it("rejects empty/null and non-path values", () => {
    expect(safeCallback(null, origin)).toBe("/");
    expect(safeCallback("", origin)).toBe("/");
    expect(safeCallback("account", origin)).toBe("/");
    expect(safeCallback("javascript:alert(1)", origin)).toBe("/");
  });

  it("strips a cross-origin target that sneaks through URL parsing", () => {
    // Backslashes can trick some parsers into a new host.
    expect(safeCallback("/\\evil.example", origin)).toBe("/");
  });
});
