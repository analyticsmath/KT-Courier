import { describe, expect, it } from "vitest";
import { hashDriverEarningCalculation } from "@/lib/driver-earnings/driver-earning-idempotency";

describe("driver earning concurrency integration", () => {
  it("generates deterministic idempotency hashes for driver earning calculation", () => {
    const snapshot = {
      subjectType: "COURIER_DELIVERY" as const,
      subjectId: "asg_1",
      subjectPublicReference: "ASG-1",
      assignmentId: "asg_1",
      assignmentPublicReference: "ASG-1",
      assignmentVersion: "1",
      driverId: "drv_1",
      driverPublicReference: "DRV-1",
      walletId: "wal_1",
      orderId: "ord_1",
      orderPublicReference: "ORD-1",
      paymentId: "pay_1",
      paymentPublicReference: "PAY-1",
      settlementReference: "SET-1",
      settlementVersion: "1",
      calculationVersion: "1",
      completionEvidenceReference: "EVD-1",
      serviceCompletedAt: "2026-07-23T00:00:00.000Z",
      authoritativeAt: "2026-07-23T00:00:00.000Z",
      releaseEligibleAt: "2026-07-23T00:00:00.000Z",
      driverSettlementBasisAmount: "50.00",
      attributedCommissionAmount: "5.00",
      netDriverEarningAmount: "45.00",
      currency: "ZAR" as const,
      commissionCharges: [],
    };
    const hash1 = hashDriverEarningCalculation(snapshot);
    const hash2 = hashDriverEarningCalculation(snapshot);
    expect(hash1).toBe(hash2);
  });
});
