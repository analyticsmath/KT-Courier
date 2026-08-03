import type { StoreSettlementSnapshot } from "@/lib/store-earnings/store-settlement-snapshot";

export function settlementSnapshot(overrides: Partial<StoreSettlementSnapshot> = {}): StoreSettlementSnapshot {
  return {
    subjectType: "MARKETPLACE_ORDER",
    subjectId: "subject-1",
    subjectPublicReference: "ORDER-1",
    storeId: "store-1",
    storePublicReference: "STORE-1",
    walletId: "wallet-1",
    paymentId: "payment-1",
    paymentPublicReference: "PAY-1",
    settlementReference: "SETTLEMENT-1",
    settlementVersion: "v1",
    calculationVersion: "store-settlement-v1",
    authoritativeAt: "2026-07-18T00:00:00.000Z",
    sellerSettlementBasisAmount: "100.00",
    attributedCommissionAmount: "10.00",
    netStoreEarningAmount: "90.00",
    currency: "ZAR",
    commissionCharges: [{ commissionAllocationId: "allocation-1", commissionAllocationPublicReference: "CA-1", amount: "10.00", currency: "ZAR" }],
    ...overrides,
  };
}
