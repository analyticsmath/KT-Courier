import { describe, expect, it } from "vitest";
import { hashStoreSettlementSnapshot } from "@/lib/store-earnings/store-earning-idempotency";

describe("store earning concurrency integration", () => {
  it("generates deterministic idempotency hashes for store earning accrual", () => {
    const snapshot = {
      subjectType: "MARKETPLACE_ORDER" as const,
      subjectId: "ord_1",
      subjectPublicReference: "ORD-1",
      storeId: "store_1",
      storePublicReference: "STORE-1",
      walletId: "wal_1",
      paymentId: "pay_1",
      paymentPublicReference: "PAY-1",
      settlementReference: "SET-1",
      settlementVersion: "1",
      calculationVersion: "1",
      authoritativeAt: "2026-07-23T00:00:00.000Z",
      sellerSettlementBasisAmount: "100.00",
      attributedCommissionAmount: "15.00",
      netStoreEarningAmount: "85.00",
      currency: "ZAR" as const,
      commissionCharges: [],
    };
    const hash1 = hashStoreSettlementSnapshot(snapshot);
    const hash2 = hashStoreSettlementSnapshot(snapshot);
    expect(hash1).toBe(hash2);
  });
});
