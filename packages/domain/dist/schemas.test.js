import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fillIntentSchema, prepareDepositSchema, requestTransferSchema, requestWithdrawalSchema, submitIntentSchema, } from "./schemas.js";
const validKey = "idem-0001-abcd";
test("prepareDepositSchema rejects zero and negative amounts", () => {
    assert.equal(prepareDepositSchema.safeParse({ instrument: "CC", amount: "0", idempotencyKey: validKey }).success, false);
    // Regex forbids a leading '-', so a negative is rejected outright.
    assert.equal(prepareDepositSchema.safeParse({ instrument: "CC", amount: "-5", idempotencyKey: validKey }).success, false);
    assert.equal(prepareDepositSchema.safeParse({ instrument: "CC", amount: "0.0", idempotencyKey: validKey }).success, false);
});
test("prepareDepositSchema accepts a positive amount", () => {
    const r = prepareDepositSchema.safeParse({ instrument: "CC", amount: "1.5", idempotencyKey: validKey });
    assert.equal(r.success, true);
});
test("withdrawal and transfer schemas also require a positive amount", () => {
    assert.equal(requestWithdrawalSchema.safeParse({ instrument: "CC", amount: "0", idempotencyKey: validKey }).success, false);
    assert.equal(requestTransferSchema.safeParse({
        recipientEmail: "a@b.com",
        instrument: "CC",
        amount: "0",
        idempotencyKey: validKey,
    }).success, false);
});
test("fillIntentSchema rejects a zero buyAmount", () => {
    assert.equal(fillIntentSchema.safeParse({ intentId: "i1", solver: "s::1", buyAmount: "0" }).success, false);
    assert.equal(fillIntentSchema.safeParse({ intentId: "i1", solver: "s::1", buyAmount: "0.0" }).success, false);
    assert.equal(fillIntentSchema.safeParse({ intentId: "i1", solver: "s::1", buyAmount: "1" }).success, true);
});
test("fillIntentSchema rejects non-decimal buyAmount", () => {
    assert.equal(fillIntentSchema.safeParse({ intentId: "i1", solver: "s::1", buyAmount: "abc" }).success, false);
    assert.equal(fillIntentSchema.safeParse({ intentId: "i1", solver: "s::1", buyAmount: "" }).success, false);
});
test("submitIntentSchema enforces a valid pair, ISO deadline and signature", () => {
    const base = {
        domain: "intent-swap/v1",
        intentId: "abc",
        maker: "maker::1",
        pair: "CBTC_USDCX",
        sellAmount: "1",
        minBuyAmount: "1",
        deadline: new Date().toISOString(),
        nonce: 1,
        signature: "sig",
    };
    assert.equal(submitIntentSchema.safeParse(base).success, true);
    assert.equal(submitIntentSchema.safeParse({ ...base, pair: "NOPE" }).success, false);
    assert.equal(submitIntentSchema.safeParse({ ...base, deadline: "not-a-date" }).success, false);
    assert.equal(submitIntentSchema.safeParse({ ...base, signature: "" }).success, false);
    assert.equal(submitIntentSchema.safeParse({ ...base, nonce: -1 }).success, false);
});
//# sourceMappingURL=schemas.test.js.map