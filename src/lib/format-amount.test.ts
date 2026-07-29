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

  it("rounds float dust from balance math", () => {
    expect(formatAmount("1.8119299999999998")).toBe("1.81193");
    expect(formatAmount(1.8119299999999998)).toBe("1.81193");
    expect(formatAmount("10.121340000000001")).toBe("10.12134");
  });

  it("preserves meaningful USDCx / CC precision", () => {
    expect(formatAmount("1.81193")).toBe("1.81193");
    expect(formatAmount("0.0000000001")).toBe("0.0000000001");
  });

  it("returns a dash for nullish / NaN / undefined", () => {
    expect(formatAmount(null)).toBe("—");
    expect(formatAmount(undefined)).toBe("—");
    expect(formatAmount(Number.NaN)).toBe("—");
    expect(formatAmount("NaN")).toBe("—");
  });
});
