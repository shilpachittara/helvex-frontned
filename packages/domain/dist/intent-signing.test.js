import { strict as assert } from "node:assert";
import { test } from "node:test";
import { canonicalizeIntentPayload, hashIntentPayload, toCanonicalPayload, } from "./intent-signing.js";
const input = {
    intentId: "intent-1",
    maker: "maker::1",
    pair: "CBTC_USDCX",
    sellAmount: "0.01",
    minBuyAmount: "10",
    deadline: "2030-01-01T00:00:00.000Z",
    nonce: 42,
};
test("canonicalization is deterministic and key-order independent", () => {
    const a = toCanonicalPayload(input);
    // Same logical payload, different object key insertion order.
    const b = toCanonicalPayload({
        nonce: 42,
        deadline: "2030-01-01T00:00:00.000Z",
        minBuyAmount: "10",
        sellAmount: "0.01",
        pair: "CBTC_USDCX",
        maker: "maker::1",
        intentId: "intent-1",
    });
    assert.equal(canonicalizeIntentPayload(a), canonicalizeIntentPayload(b));
    assert.equal(hashIntentPayload(a), hashIntentPayload(b));
});
test("canonical string pins the field order", () => {
    const s = canonicalizeIntentPayload(toCanonicalPayload(input));
    assert.equal(s, '{"domain":"intent-swap/v1","intentId":"intent-1","maker":"maker::1","pair":"CBTC_USDCX","sellAmount":"0.01","minBuyAmount":"10","deadline":"2030-01-01T00:00:00.000Z","nonce":42}');
});
test("changing any field changes the hash", () => {
    const base = hashIntentPayload(toCanonicalPayload(input));
    assert.notEqual(base, hashIntentPayload(toCanonicalPayload({ ...input, sellAmount: "0.02" })));
    assert.notEqual(base, hashIntentPayload(toCanonicalPayload({ ...input, nonce: 43 })));
    assert.notEqual(base, hashIntentPayload(toCanonicalPayload({ ...input, maker: "maker::2" })));
});
//# sourceMappingURL=intent-signing.test.js.map