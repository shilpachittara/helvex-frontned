import type { InstrumentConfig, InstrumentsMap, NetworkInstrumentsConfig, PairConfig, PairId } from "./types.js";
export declare class PairRegistry {
    private readonly pairs;
    private readonly instruments;
    constructor(config: NetworkInstrumentsConfig);
    listPairs(): PairConfig[];
    /** Resolve a token symbol key (e.g. "CC") to its full instrument config. */
    instrumentForSymbol(symbol: string): InstrumentConfig;
    /** Resolve a token symbol key (e.g. "CC") to its ledger instrument id. */
    instrumentIdForSymbol(symbol: string): string;
    /**
     * Loop SDK transfer instrument selector. CC/Amulet omits admin (SDK default);
     * registry tokens require instrument_id + instrument_admin.
     */
    loopInstrumentForSymbol(symbol: string): {
        instrument_id: string;
        instrument_admin?: string;
    };
    /** Reverse lookup: ledger instrument id -> token symbol key. */
    symbolForInstrumentId(instrumentId: string): string | undefined;
    getPair(pairId: PairId): PairConfig;
    resolveLegs(pairId: PairId): {
        sellInstrument: InstrumentsMap[keyof InstrumentsMap];
        buyInstrument: InstrumentsMap[keyof InstrumentsMap];
    };
    validateAmounts(pairId: PairId, sellAmount: string, minBuyAmount: string): void;
}
//# sourceMappingURL=pairs.d.ts.map