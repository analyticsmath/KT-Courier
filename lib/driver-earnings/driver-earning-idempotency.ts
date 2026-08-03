import { createHash } from "node:crypto";
import type { DriverSettlementSnapshot } from "./driver-settlement-snapshot";

export function hashDriverEarningCalculation(snapshot: DriverSettlementSnapshot): string {
  const canonical = {
    subjectType: snapshot.subjectType, subjectId: snapshot.subjectId, subjectPublicReference: snapshot.subjectPublicReference,
    assignmentId: snapshot.assignmentId, assignmentPublicReference: snapshot.assignmentPublicReference, assignmentVersion: snapshot.assignmentVersion,
    driverId: snapshot.driverId, driverPublicReference: snapshot.driverPublicReference, walletId: snapshot.walletId,
    orderId: snapshot.orderId, orderPublicReference: snapshot.orderPublicReference, paymentId: snapshot.paymentId, paymentPublicReference: snapshot.paymentPublicReference,
    settlementReference: snapshot.settlementReference, settlementVersion: snapshot.settlementVersion, calculationVersion: snapshot.calculationVersion,
    completionEvidenceReference: snapshot.completionEvidenceReference, serviceCompletedAt: snapshot.serviceCompletedAt, authoritativeAt: snapshot.authoritativeAt, releaseEligibleAt: snapshot.releaseEligibleAt,
    basis: snapshot.driverSettlementBasisAmount, commission: snapshot.attributedCommissionAmount, earning: snapshot.netDriverEarningAmount, currency: snapshot.currency,
    charges: [...snapshot.commissionCharges].sort((a, b) => a.commissionAllocationId.localeCompare(b.commissionAllocationId)).map((row) => ({ allocationId: row.commissionAllocationId, allocationReference: row.commissionAllocationPublicReference, amount: row.amount, currency: row.currency })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function driverEarningCreationRequestHash(operationId: string, snapshot: DriverSettlementSnapshot): string {
  return createHash("sha256").update(JSON.stringify({ operationId, calculationHash: hashDriverEarningCalculation(snapshot) })).digest("hex");
}
