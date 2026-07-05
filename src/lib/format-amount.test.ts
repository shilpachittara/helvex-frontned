import { describe, expect, it } from "vitest";
import { formatAmount } from "./format-amount";

describe("formatAmount", () => {
  it("trims trailing zeros", () => {
    expect(formatAmount("0.0100000000")).toBe("0.01");
    expect(formatAmount("100.000")).toBe("100");
    expect(formatAmount("1000")).toBe("1000");
  });

  it("normalizes leading zeros", () => {
    expect(formatAmount("007.50")).toBe("7.5");
    expect(formatAmount("0.5")).toBe("0.5");
  });

  it("handles negatives", () => {
    expect(formatAmount("-1.2500")).toBe("-1.25");
  });

  it("returns a dash for nullish / NaN / undefined", () => {
    expect(formatAmount(null)).toBe("—");
    expect(formatAmount(undefined)).toBe("—");
    expect(formatAmount(Number.NaN)).toBe("—");
    expect(formatAmount("NaN")).toBe("—");
  });

  it("passes through values it can't safely format instead of crashing", () => {
    // Scientific notation isn't a plain decimal — returned as-is, not mangled.
    expect(formatAmount("1e-8")).toBe("1e-8");
  });
});
