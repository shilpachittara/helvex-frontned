import { describe, expect, it } from "vitest";
import { availableCovers, toDepositInstrument } from "./fund-from-loop";

describe("toDepositInstrument", () => {
  it("maps UI and ledger names to deposit symbols", () => {
    expect(toDepositInstrument("CC")).toBe("CC");
    expect(toDepositInstrument("Amulet")).toBe("CC");
    expect(toDepositInstrument("cbtc")).toBe("CBTC");
    expect(toDepositInstrument("USDCx")).toBe("USDCX");
    expect(toDepositInstrument("USDC")).toBe("USDCX");
  });

  it("rejects unknown tokens", () => {
    expect(() => toDepositInstrument("ETH")).toThrow(/Unsupported/);
  });
});

describe("availableCovers", () => {
  it("is true when available meets or exceeds need", () => {
    expect(availableCovers("12", "12")).toBe(true);
    expect(availableCovers("12.01", "12")).toBe(true);
    expect(availableCovers("0.0002", "0.0001")).toBe(true);
  });

  it("is false when missing or short", () => {
    expect(availableCovers(null, "1")).toBe(false);
    expect(availableCovers("", "1")).toBe(false);
    expect(availableCovers("0.9", "1")).toBe(false);
    expect(availableCovers("abc", "1")).toBe(false);
  });
});
