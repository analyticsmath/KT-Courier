import { describe, expect, it } from "vitest";
import { cumulativeLineAllocation } from "@/lib/store-orders/allocation";
describe("partial-quantity-allocation", () => {
  it("uses cumulative allocation so repeated adjustments reconcile exactly", () => {
    expect(cumulativeLineAllocation({ totalAmount: "10.00", originalQuantity: 3, previouslyResolvedQuantity: 0, resolvedQuantityAfter: 1 })).toBe("3.33");
    expect(cumulativeLineAllocation({ totalAmount: "10.00", originalQuantity: 3, previouslyResolvedQuantity: 1, resolvedQuantityAfter: 2 })).toBe("3.33");
    expect(cumulativeLineAllocation({ totalAmount: "10.00", originalQuantity: 3, previouslyResolvedQuantity: 2, resolvedQuantityAfter: 3 })).toBe("3.34");
  });
  it("never resolves more than ordered", () => expect(() => cumulativeLineAllocation({ totalAmount: "10.00", originalQuantity: 2, previouslyResolvedQuantity: 1, resolvedQuantityAfter: 3 })).toThrow("outside"));
});
