import { expect, it } from "vitest";
import { calculateDriverEarningRefundAdjustment } from "@/lib/driver-earnings/driver-earning-refund-adjustment";
it("rounds partial cumulative adjustments half up", () => expect(calculateDriverEarningRefundAdjustment({ originalDriverEarningAmount: "10.00", refundableDriverBasisAmount: "30.00", cumulativeDriverRefundAmount: "10.00", priorDriverEarningAdjustment: "0.00" }).currentAdjustment).toBe("3.33"));
it("consumes the exact final cent", () => expect(calculateDriverEarningRefundAdjustment({ originalDriverEarningAmount: "10.00", refundableDriverBasisAmount: "30.00", cumulativeDriverRefundAmount: "30.00", priorDriverEarningAdjustment: "6.67" }).currentAdjustment).toBe("3.33"));
