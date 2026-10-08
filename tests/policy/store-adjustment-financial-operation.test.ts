import { describe, expect, it } from "vitest";
import { storeAdjustmentChildOperation } from "@/lib/store-orders/financial-operation";
import { commissionAdjustmentReversalPosting } from "@/lib/commissions/commission-ledger-policy";
import { storeEarningReversalPosting } from "@/lib/store-earnings/store-earning-ledger-policy";
import { LEDGER_MAX_KEY_LENGTH } from "@/lib/ledger/config";

describe("bounded composed financial operations", () => {
  it("preserves short existing refund, commission and earning replay identities", () => {
    expect(storeAdjustmentChildOperation("original-operation", "refund")).toBe("original-operation:refund");
    expect(storeAdjustmentChildOperation("original-operation", "commission", "allocation")).toBe("original-operation:commission:allocation");
    expect(storeAdjustmentChildOperation("original-operation", "store-earning")).toBe("original-operation:store-earning");
  });
  it("bounds a maximum-length parent and distinguishes every source and authority", () => {
    const parent = "x".repeat(160);
    const keys = [storeAdjustmentChildOperation(parent, "refund"), storeAdjustmentChildOperation(parent, "store-earning"), storeAdjustmentChildOperation(parent, "commission", "a"), storeAdjustmentChildOperation(parent, "commission", "b"), storeAdjustmentChildOperation(`${parent.slice(0, -1)}y`, "commission", "a")];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^soadj:[a-f0-9]{64}$/);
    expect(keys[2]).toBe(storeAdjustmentChildOperation(parent, "commission", "a"));
  });
  it("fits actual nested commission and earning journal key limits", () => {
    const parent = "x".repeat(160);
    const commission = commissionAdjustmentReversalPosting({ accrualReference: `comm_${"a".repeat(48)}`, allocationReference: "allocation", originalJournalId: "original", heldAccountId: "held", allocationAccountId: "source", amount: "10.00", operationId: storeAdjustmentChildOperation(parent, "commission", "allocation"), originalAmount: "10.00", previouslyReversedAmount: "0.00" });
    const earning = storeEarningReversalPosting({ earningReference: `earn_${"b".repeat(48)}`, amount: "90.00", storePayableAccountId: "payable", customerFundsHeldAccountId: "held", storePublicReference: "store", subjectPublicReference: "subject", settlementVersion: "phase20-v1", reasonCode: "MARKETPLACE_STORE_ADJUSTMENT", operationId: storeAdjustmentChildOperation(parent, "store-earning") });
    for (const posting of [commission, earning]) { expect(posting.idempotencyKey.length).toBeLessThanOrEqual(LEDGER_MAX_KEY_LENGTH); expect(posting.sourceReference!.length).toBeLessThanOrEqual(LEDGER_MAX_KEY_LENGTH); }
  });
});
