import { describe, expect, it } from "vitest";
import { calculateStoreEarningRefundAdjustment } from "@/lib/store-earnings/store-earning-refund-adjustment";

describe("cumulative store earning refund adjustment", () => {
  it("uses cumulative HALF_UP cents", () => expect(calculateStoreEarningRefundAdjustment({ originalStoreEarningAmount: "10.00", refundableStoreBasisAmount: "3.00", cumulativeStoreRefundAmount: "1.00", priorStoreEarningAdjustment: "0.00" })).toEqual({ desiredCumulativeAdjustment: "3.33", currentAdjustment: "3.33" }));
  it("assigns the exact final cents on full refund", () => expect(calculateStoreEarningRefundAdjustment({ originalStoreEarningAmount: "10.00", refundableStoreBasisAmount: "3.00", cumulativeStoreRefundAmount: "3.00", priorStoreEarningAdjustment: "6.67" })).toEqual({ desiredCumulativeAdjustment: "10.00", currentAdjustment: "3.33" }));
  it("rejects cumulative refund above authoritative basis", () => expect(() => calculateStoreEarningRefundAdjustment({ originalStoreEarningAmount: "10.00", refundableStoreBasisAmount: "3.00", cumulativeStoreRefundAmount: "3.01", priorStoreEarningAdjustment: "0.00" })).toThrow());
});
