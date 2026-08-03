/* eslint-disable @typescript-eslint/no-explicit-any -- compact repository seams are intentional DB-free test doubles. */
import { describe, expect, it, vi } from "vitest";
import { allocateSubscriptionRefundReversal, applySubscriptionRefundAdjustment } from "@/lib/subscriptions/subscription-refund.service";

describe("subscription refund accounting adjustment", () => {
  it("allocates unrecognised value before recognised value with exact final cents", () => {
    expect(allocateSubscriptionRefundReversal({ settlementAmount: "10.00", cumulativeRefundAmount: "10.00", priorAdjustmentAmount: "0.00", deferredAmount: "6.67", recognizedAmount: "3.33", taxAmount: "0.00", authoritativeTax: false })).toEqual({ deferredAmount: "6.67", recognizedAmount: "3.33", taxAmount: "0.00", totalAmount: "10.00" });
  });

  it("rejects cumulative amounts above settlement and tax without authority", () => {
    expect(() => allocateSubscriptionRefundReversal({ settlementAmount: "10.00", cumulativeRefundAmount: "10.01", priorAdjustmentAmount: "0.00", deferredAmount: "10.00", recognizedAmount: "0.00", taxAmount: "0.00", authoritativeTax: false })).toThrow("exceeds coherent settlement");
    expect(() => allocateSubscriptionRefundReversal({ settlementAmount: "10.00", cumulativeRefundAmount: "10.00", priorAdjustmentAmount: "0.00", deferredAmount: "8.00", recognizedAmount: "0.00", taxAmount: "2.00", authoritativeTax: false })).toThrow("cannot be allocated");
  });

  it("links Phase 15 replay-safe accounting and entitlement adjustment", async () => {
    const repository = { loadRefundAdjustmentState: vi.fn().mockResolvedValue({ settlementAmount: "10.00", cumulativeRefundAmount: "5.00", priorAdjustmentAmount: "0.00", deferredAmount: "5.00", recognizedAmount: "5.00", taxAmount: "0.00", authoritativeTax: false }), applyFinancialReversal: vi.fn().mockResolvedValue({ outcome: "APPLIED", journalReference: "lj_1" }), reconcileEntitlementsAfterRefund: vi.fn().mockResolvedValue({ outcome: "ADJUSTED" }), openRefundReconciliation: vi.fn() } as any;
    await expect(applySubscriptionRefundAdjustment(repository, { invoiceId: "inv_1", billingCycleId: "cycle_1", contractId: "con_1", paymentId: "pay_1", paymentReference: "payref_1", total: "10.00", settledAmount: "10.00", currency: "ZAR", refundReference: "RF_1", operationId: "refund_1" })).resolves.toMatchObject({ outcome: "APPLIED", journalReference: "lj_1" });
  });
});
