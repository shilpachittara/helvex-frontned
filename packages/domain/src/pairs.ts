import type {
  InstrumentConfig,
  InstrumentsMap,
  NetworkInstrumentsConfig,
  PairConfig,
  PairId,
} from "./types.js";

function parseAmount(value: string, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${label}`);
  return n;
}

export class PairRegistry {
  private readonly pairs: Map<PairId, PairConfig>;
  private readonly instruments: InstrumentsMap;

  constructor(config: NetworkInstrumentsConfig) {
    this.instruments = config.instruments;
    this.pairs = new Map(config.pairs.map((p) => [p.id, p]));
  }

  listPairs(): PairConfig[] {
    return [...this.pairs.values()];
  }

  /** Resolve a token symbol key (e.g. "CC") to its full instrument config. */
  instrumentForSymbol(symbol: string): InstrumentConfig {
    const instrument = (
      this.instruments as unknown as Record<string, InstrumentConfig>
    )[symbol];
    if (!instrument) throw new Error(`Unknown instrument symbol: ${symbol}`);
    return instrument;
  }

  /** Resolve a token symbol key (e.g. "CC") to its ledger instrument id. */
  instrumentIdForSymbol(symbol: string): string {
    return this.instrumentForSymbol(symbol).instrumentId;
  }

  /**
   * Loop SDK transfer instrument selector. CC/Amulet omits admin (SDK default);
   * registry tokens require instrument_id + instrument_admin.
   */
  loopInstrumentForSymbol(symbol: string): {
    instrument_id: string;
    instrument_admin?: string;
  } {
    const meta = this.instrumentForSymbol(symbol);
    if (symbol === "CC" || meta.instrumentId === "Amulet") {
      return { instrument_id: "Amulet" };
    }
    return {
      instrument_id: meta.instrumentId,
      instrument_admin: meta.adminParty,
    };
  }

  /** Reverse lookup: ledger instrument id -> token symbol key. */
  symbolForInstrumentId(instrumentId: string): string | undefined {
    for (const [key, meta] of Object.entries(this.instruments)) {
      if (meta.instrumentId === instrumentId) return key;
    }
    return undefined;
  }

  getPair(pairId: PairId): PairConfig {
    const pair = this.pairs.get(pairId);
    if (!pair) throw new Error(`Unknown pair: ${pairId}`);
    return pair;
  }

  resolveLegs(pairId: PairId): {
    sellInstrument: InstrumentsMap[keyof InstrumentsMap];
    buyInstrument: InstrumentsMap[keyof InstrumentsMap];
  } {
    const pair = this.getPair(pairId);
    return {
      sellInstrument: this.instruments[pair.sell],
      buyInstrument: this.instruments[pair.buy],
    };
  }

  validateAmounts(
    pairId: PairId,
    sellAmount: string,
    minBuyAmount: string,
  ): void {
    const { sellInstrument, buyInstrument } = this.resolveLegs(pairId);
    const sell = parseAmount(sellAmount, "sell amount");
    const buy = parseAmount(minBuyAmount, "min buy amount");

    if (sell <= 0 || buy <= 0) {
      throw new Error("Amounts must be positive");
    }
    if (sell < parseAmount(sellInstrument.minAmount, "min sell")) {
      throw new Error(
        `Sell amount below minimum ${sellInstrument.minAmount} ${sellInstrument.symbol}`,
      );
    }
    if (buy < parseAmount(buyInstrument.minAmount, "min buy")) {
      throw new Error(
        `Min buy below minimum ${buyInstrument.minAmount} ${buyInstrument.symbol}`,
      );
    }
  }
}
