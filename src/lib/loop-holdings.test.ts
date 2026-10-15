import { describe, expect, it } from "vitest";
import { parseLoopHoldings, unlockedForSymbol } from "./loop-holdings";

const payload = [
  {
    symbol: "CC",
    instrument_id: { admin: "DSO::1220", id: "Amulet" },
    total_unlocked_coin: "25.5",
    total_locked_coin: "1",
  },
  {
    symbol: "USDCx",
    instrument_id: { admin: "circle::1220", id: "USDCx" },
    total_unlocked_coin: "10",
    total_locked_coin: "0",
  },
];

describe("parseLoopHoldings", () => {
  it("keeps unlocked and locked amounts", () => {
    const rows = parseLoopHoldings(payload);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ symbol: "CC", instrumentId: "Amulet", unlocked: "25.5" });
  });

  it("returns nothing for an unexpected payload", () => {
    expect(parseLoopHoldings(null)).toEqual([]);
    expect(parseLoopHoldings({ holdings: [] })).toEqual([]);
  });
});

describe("unlockedForSymbol", () => {
  const rows = parseLoopHoldings(payload);

  it("matches CC to Amulet and USDCx by symbol", () => {
    expect(unlockedForSymbol(rows, "CC")).toBe("25.5");
    expect(unlockedForSymbol(rows, "Amulet")).toBe("25.5");
    expect(unlockedForSymbol(rows, "USDCX")).toBe("10");
  });

  it("is zero when the wallet has no row for that token", () => {
    expect(unlockedForSymbol(rows, "CBTC")).toBe("0");
    expect(unlockedForSymbol([], "CC")).toBe("0");
  });
});
