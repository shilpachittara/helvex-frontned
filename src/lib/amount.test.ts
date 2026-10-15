import { describe, expect, it } from "vitest";
import { exceedsAvailable, isValidAmount, normalizeAmount, raisedSellAmount } from "./amount";

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

describe("exceedsAvailable", () => {
  it("flags an amount above a zero or smaller balance", () => {
    expect(exceedsAvailable("10", "0")).toBe(true);
    expect(exceedsAvailable("10", "0.0000000000")).toBe(true);
    expect(exceedsAvailable("1.5", "1")).toBe(true);
  });

  it("allows an amount equal to or under the available balance", () => {
    expect(exceedsAvailable("10", "10.0000000000")).toBe(false);
    expect(exceedsAvailable("0.5", "1")).toBe(false);
  });

  it("ignores amounts that are not a positive decimal", () => {
    expect(exceedsAvailable("", "0")).toBe(false);
    expect(exceedsAvailable("0", "0")).toBe(false);
  });
});

describe("raisedSellAmount", () => {
  it("lifts a dust CBTC sell to the $10 floor and the buy-token minimum", () => {
    const next = raisedSellAmount({
      sellAmount: "0.000015",
      notionalUsd: 1.21,
      minNotionalUsd: 10,
      maxNotionalUsd: 1000,
      rate: 765937.914,
      minBuy: "100",
      minSell: "0.000015",
      sellDecimals: 10,
    });
    expect(next).toBeTruthy();
    expect(Number(next)).toBeGreaterThan(0.000131);
    expect(Number(next) * (1.21 / 0.000015)).toBeGreaterThan(10);
  });

  it("leaves an amount that already clears the floor", () => {
    expect(
      raisedSellAmount({
        sellAmount: "0.001",
        notionalUsd: 80,
        minNotionalUsd: 10,
        maxNotionalUsd: 1000,
        rate: 80000,
        minBuy: "10",
        minSell: "0.000015",
        sellDecimals: 10,
      }),
    ).toBeNull();
  });

  it("does not raise a trade that is already above the maximum", () => {
    expect(
      raisedSellAmount({
        sellAmount: "1",
        notionalUsd: 1500,
        minNotionalUsd: 10,
        maxNotionalUsd: 1000,
        rate: 1,
        minBuy: "1",
        minSell: "0.000015",
        sellDecimals: 10,
      }),
    ).toBeNull();
  });
});
