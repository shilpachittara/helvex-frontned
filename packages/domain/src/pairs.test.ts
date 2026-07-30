import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PairRegistry } from "./pairs.js";
import type { NetworkInstrumentsConfig } from "./types.js";

function instrument(symbol: string, minAmount: string) {
  return {
    instrumentId: `${symbol.toLowerCase()}-id`,
    adminParty: `${symbol}Admin`,
    symbol,
    decimals: 10,
    minAmount,
  };
}

const config: NetworkInstrumentsConfig = {
  network: "test",
  instruments: {
    CC: instrument("CC", "1"),
    CBTC: instrument("CBTC", "0.001"),
    USDCX: instrument("USDCX", "10"),
  },
  pairs: [
    { id: "CBTC_USDCX", sell: "CBTC", buy: "USDCX" },
    { id: "CC_USDCX", sell: "CC", buy: "USDCX" },
  ],
};

const registry = new PairRegistry(config);

test("resolveLegs maps a pair to its instruments", () => {
  const legs = registry.resolveLegs("CBTC_USDCX");
  assert.equal(legs.sellInstrument.symbol, "CBTC");
  assert.equal(legs.buyInstrument.symbol, "USDCX");
});

test("instrumentIdForSymbol resolves and rejects unknown symbols", () => {
  assert.equal(registry.instrumentIdForSymbol("CC"), "cc-id");
  assert.throws(() => registry.instrumentIdForSymbol("DOGE"));
});

test("loopInstrumentForSymbol maps CC to Amulet and registry tokens with admin", () => {
  assert.deepEqual(registry.loopInstrumentForSymbol("CC"), { instrument_id: "Amulet" });
  assert.deepEqual(registry.loopInstrumentForSymbol("USDCX"), {
    instrument_id: "usdcx-id",
    instrument_admin: "USDCXAdmin",
  });
});

test("validateAmounts accepts amounts at exactly the minimum (inclusive)", () => {
  // minCBTC = 0.001, minUSDCX = 10
  assert.doesNotThrow(() => registry.validateAmounts("CBTC_USDCX", "0.001", "10"));
});

test("validateAmounts rejects amounts below the minimum", () => {
  assert.throws(() => registry.validateAmounts("CBTC_USDCX", "0.0001", "10"));
  assert.throws(() => registry.validateAmounts("CBTC_USDCX", "0.001", "9"));
});

test("validateAmounts rejects zero, negative and non-numeric", () => {
  assert.throws(() => registry.validateAmounts("CBTC_USDCX", "0", "10"));
  assert.throws(() => registry.validateAmounts("CBTC_USDCX", "0.001", "0"));
  assert.throws(() => registry.validateAmounts("CBTC_USDCX", "abc", "10"));
});

test("getPair throws on an unknown pair", () => {
  assert.throws(() => registry.getPair("USDCX_CC"));
});
