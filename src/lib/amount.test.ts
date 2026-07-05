import { describe, expect, it } from "vitest";
import { isValidAmount } from "./amount";

describe("isValidAmount", () => {
  it("accepts positive decimals", () => {
    expect(isValidAmount("1")).toBe(true);
    expect(isValidAmount("0.01")).toBe(true);
    expect(isValidAmount(" 12.5 ")).toBe(true);
  });

  it("rejects zero, negative, empty and malformed", () => {
    for (const v of ["0", "0.0", "-1", "", "abc", "1.2.3", "1e5", "NaN", "  "]) {
      expect(isValidAmount(v)).toBe(false);
    }
  });
});
