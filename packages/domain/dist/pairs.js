function parseAmount(value, label) {
    const n = Number(value);
    if (!Number.isFinite(n))
        throw new Error(`Invalid ${label}`);
    return n;
}
export class PairRegistry {
    pairs;
    instruments;
    constructor(config) {
        this.instruments = config.instruments;
        this.pairs = new Map(config.pairs.map((p) => [p.id, p]));
    }
    listPairs() {
        return [...this.pairs.values()];
    }
    /** Resolve a token symbol key (e.g. "CC") to its full instrument config. */
    instrumentForSymbol(symbol) {
        const instrument = this.instruments[symbol];
        if (!instrument)
            throw new Error(`Unknown instrument symbol: ${symbol}`);
        return instrument;
    }
    /** Resolve a token symbol key (e.g. "CC") to its ledger instrument id. */
    instrumentIdForSymbol(symbol) {
        return this.instrumentForSymbol(symbol).instrumentId;
    }
    /**
     * Loop SDK transfer instrument selector. CC/Amulet omits admin (SDK default);
     * registry tokens require instrument_id + instrument_admin.
     */
    loopInstrumentForSymbol(symbol) {
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
    symbolForInstrumentId(instrumentId) {
        for (const [key, meta] of Object.entries(this.instruments)) {
            if (meta.instrumentId === instrumentId)
                return key;
        }
        return undefined;
    }
    getPair(pairId) {
        const pair = this.pairs.get(pairId);
        if (!pair)
            throw new Error(`Unknown pair: ${pairId}`);
        return pair;
    }
    resolveLegs(pairId) {
        const pair = this.getPair(pairId);
        return {
            sellInstrument: this.instruments[pair.sell],
            buyInstrument: this.instruments[pair.buy],
        };
    }
    validateAmounts(pairId, sellAmount, minBuyAmount) {
        const { sellInstrument, buyInstrument } = this.resolveLegs(pairId);
        const sell = parseAmount(sellAmount, "sell amount");
        const buy = parseAmount(minBuyAmount, "min buy amount");
        if (sell <= 0 || buy <= 0) {
            throw new Error("Amounts must be positive");
        }
        if (sell < parseAmount(sellInstrument.minAmount, "min sell")) {
            throw new Error(`Sell amount below minimum ${sellInstrument.minAmount} ${sellInstrument.symbol}`);
        }
        if (buy < parseAmount(buyInstrument.minAmount, "min buy")) {
            throw new Error(`Min buy below minimum ${buyInstrument.minAmount} ${buyInstrument.symbol}`);
        }
    }
}
//# sourceMappingURL=pairs.js.map