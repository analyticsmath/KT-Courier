import { describe, expect, it } from "vitest";
import { hashStoreSettlementSnapshot } from "@/lib/store-earnings/store-earning-idempotency";
import { settlementSnapshot } from "./fixtures";

describe("store earning idempotency", () => {
  it("is stable when commission evidence arrives in a different order", () => {
    const charges = [{ commissionAllocationId: "a", commissionAllocationPublicReference: "CA-A", amount: "4.00", currency: "ZAR" as const }, { commissionAllocationId: "b", commissionAllocationPublicReference: "CA-B", amount: "6.00", currency: "ZAR" as const }];
    expect(hashStoreSettlementSnapshot(settlementSnapshot({ commissionCharges: charges }))).toBe(hashStoreSettlementSnapshot(settlementSnapshot({ commissionCharges: [...charges].reverse() })));
  });
  it("changes when an authoritative settlement field changes", () => expect(hashStoreSettlementSnapshot(settlementSnapshot())).not.toBe(hashStoreSettlementSnapshot(settlementSnapshot({ settlementVersion: "v2" }))));
});
