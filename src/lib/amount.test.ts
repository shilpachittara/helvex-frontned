import { describe, expect, it } from "vitest";
import { isValidAmount, normalizeAmount } from "./amount";

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

describe("normalizeAmount", () => {
  /** The exact regex the API validates amounts with (no trim). */
  const BACKEND = /^\d+(\.\d+)?$/;

  it("produces a string the backend regex accepts", () => {
    // Regression: the intent form submitted "0.0003 " — isValidAmount passed
    // (it trims), the API rejected it as `Invalid request` on sellAmount.
    expect(BACKEND.test("0.0003 ")).toBe(false);
    expect(BACKEND.test(normalizeAmount("0.0003 "))).toBe(true);
  });

  it("holds for every input isValidAmount accepts", () => {
    for (const v of ["1", "0.01", " 12.5 ", "0.0003 ", "\t7\n", "0.00001"]) {
      expect(isValidAmount(v)).toBe(true);
      expect(BACKEND.test(normalizeAmount(v))).toBe(true);
    }
  });

  it("leaves the numeric value untouched", () => {
    expect(normalizeAmount(" 0.0003 ")).toBe("0.0003");
    expect(normalizeAmount("20.9157")).toBe("20.9157");
  });
});
