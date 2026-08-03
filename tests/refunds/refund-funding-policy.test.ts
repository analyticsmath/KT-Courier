import { describe, expect, it } from "vitest";
import { buildRefundFundingPlan } from "@/lib/refunds/refund-funding-policy";

describe("refund funding policy", () => {
  it("gathers commission deltas plus the exact customer-funds residual", () => {
    let index = 0;
    const plan = buildRefundFundingPlan({ refundAmount: "25.00", customerFundsHeldAccountId: "held", createReference: () => `RFA-${++index}`, adjustmentDeltas: [{ commissionAllocationId: "a1", commissionAllocationReference: "CA-1", commissionAccrualId: "c1", ledgerAccountId: "revenue", sourceType: "PLATFORM_COMMISSION_REVENUE", originalAmount: "10.00", desiredCumulativeAmount: "2.50", previousCumulativeAmount: "0.00", amount: "2.50" }] });
    expect(plan.map(({ sourceType, amount }) => ({ sourceType, amount }))).toEqual([{ sourceType: "PLATFORM_COMMISSION_REVENUE", amount: "2.50" }, { sourceType: "CUSTOMER_FUNDS_HELD", amount: "22.50" }]);
  });
  it("rejects commission funding above the refund", () => expect(() => buildRefundFundingPlan({ refundAmount: "1.00", customerFundsHeldAccountId: "held", createReference: () => "RFA", adjustmentDeltas: [{ commissionAllocationId: "a", commissionAllocationReference: "CA", commissionAccrualId: "c", ledgerAccountId: "revenue", sourceType: "PLATFORM_COMMISSION_REVENUE", originalAmount: "2.00", desiredCumulativeAmount: "2.00", previousCumulativeAmount: "0.00", amount: "2.00" }] })).toThrow(/exceeds/i));
});
