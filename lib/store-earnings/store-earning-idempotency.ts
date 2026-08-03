import { createHash } from "node:crypto";
import type { StoreSettlementSnapshot } from "./store-settlement-snapshot";

export function hashStoreSettlementSnapshot(snapshot: StoreSettlementSnapshot): string {
  const canonical = {
    subjectType: snapshot.subjectType,
    subjectId: snapshot.subjectId,
    subjectPublicReference: snapshot.subjectPublicReference,
    storeId: snapshot.storeId,
    storePublicReference: snapshot.storePublicReference,
    walletId: snapshot.walletId,
    paymentId: snapshot.paymentId,
    paymentPublicReference: snapshot.paymentPublicReference,
    settlementReference: snapshot.settlementReference,
    settlementVersion: snapshot.settlementVersion,
    calculationVersion: snapshot.calculationVersion,
    authoritativeAt: snapshot.authoritativeAt,
    sellerSettlementBasisAmount: snapshot.sellerSettlementBasisAmount,
    attributedCommissionAmount: snapshot.attributedCommissionAmount,
    netStoreEarningAmount: snapshot.netStoreEarningAmount,
    currency: snapshot.currency,
    commissionCharges: [...snapshot.commissionCharges]
      .sort((left, right) => left.commissionAllocationPublicReference.localeCompare(right.commissionAllocationPublicReference))
      .map((charge) => ({
        commissionAllocationPublicReference: charge.commissionAllocationPublicReference,
        amount: charge.amount,
        currency: charge.currency,
      })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
