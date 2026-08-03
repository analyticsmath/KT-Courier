import { describe, expect, it } from "vitest";
import { calculateCumulativeCommissionAdjustments, type RefundableCommissionAllocation } from "@/lib/refunds/refund-commission-adjustment";

const allocation = (overrides: Partial<RefundableCommissionAllocation> = {}): RefundableCommissionAllocation => ({ id: "allocation-1", publicReference: "CA-1", accrualId: "accrual-1", allocationType: "PLATFORM_COMMISSION_REVENUE", ledgerAccountId: "revenue", amount: "10.00", previouslyAdjustedAmount: "0.00", status: "ACCRUED", downstreamReleaseJournalId: null, ...overrides });

describe("cumulative commission adjustment", () => {
  it("uses cumulative half-up rounding and emits only the current delta", () => {
    expect(calculateCumulativeCommissionAdjustments({ originalPaymentAmount: "30.00", priorSuccessfulAndReservedRefundAmount: "10.00", currentRefundAmount: "10.00", allocations: [allocation({ amount: "1.00", previouslyAdjustedAmount: "0.33" })] })[0].amount).toBe("0.34");
  });
  it("consumes the exact original allocation on the final cumulative refund", () => {
    expect(calculateCumulativeCommissionAdjustments({ originalPaymentAmount: "30.00", priorSuccessfulAndReservedRefundAmount: "20.00", currentRefundAmount: "10.00", allocations: [allocation({ amount: "1.00", previouslyAdjustedAmount: "0.67" })] })[0].amount).toBe("0.33");
  });
  it("handles platform and beneficiary allocation sources", () => {
    const result = calculateCumulativeCommissionAdjustments({ originalPaymentAmount: "100.00", priorSuccessfulAndReservedRefundAmount: "0.00", currentRefundAmount: "50.00", allocations: [allocation(), allocation({ id: "allocation-2", publicReference: "CA-2", allocationType: "BENEFICIARY_COMMISSION_PAYABLE", ledgerAccountId: "payable", amount: "6.00" })] });
    expect(result.map(({ sourceType, amount }) => [sourceType, amount])).toEqual([["PLATFORM_COMMISSION_REVENUE", "5.00"], ["BENEFICIARY_COMMISSION_PAYABLE", "3.00"]]);
  });
  it("fails closed for any downstream-released allocation", () => expect(() => calculateCumulativeCommissionAdjustments({ originalPaymentAmount: "100.00", priorSuccessfulAndReservedRefundAmount: "0.00", currentRefundAmount: "10.00", allocations: [allocation({ status: "RELEASED", downstreamReleaseJournalId: "journal" })] })).toThrow(/downstream-released/i));
});
