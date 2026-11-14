import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import { platformFundedDiscountForStore } from "@/lib/store-orders/full-order-adjustment";
import { promotionLineRefund } from "@/lib/store-orders/allocation";

const money = (value: string) => new Prisma.Decimal(value);
it("reverses only the platform-funded portion of a mixed promotion", () => {
  const redemptions = [{ allocations: [{ storeGroupReference: "group", discountAmount: money("10"), platformFunding: money("6"), storeFunding: money("4") }, { storeGroupReference: "other", discountAmount: money("5"), platformFunding: money("5"), storeFunding: money("0") }] }];
  expect(platformFundedDiscountForStore(money("10"), "group", redemptions).toFixed(2)).toBe("6.00");
  expect(platformFundedDiscountForStore(money("10"), "group", [])).toEqual(money("10"));
  expect(() => platformFundedDiscountForStore(money("11"), "group", redemptions)).toThrow("funding evidence");
});

it("uses immutable per-line funding shares and conserves cents across partial refunds", () => {
  const base = { originalCharge: "10.00", platformFunding: "1.00", storeFunding: "0.50", originalQuantity: 3 };
  const first = promotionLineRefund({ ...base, previouslyResolvedQuantity: 0, resolvedQuantityAfter: 1 });
  const second = promotionLineRefund({ ...base, previouslyResolvedQuantity: 1, resolvedQuantityAfter: 2 });
  const third = promotionLineRefund({ ...base, previouslyResolvedQuantity: 2, resolvedQuantityAfter: 3 });
  expect([first, second, third].reduce((sum, item) => sum.add(item.platformSubsidyReversal), money("0")).toFixed(2)).toBe("1.00");
  expect([first, second, third].reduce((sum, item) => sum.add(item.customerRefund), money("0")).toFixed(2)).toBe("28.50");
  expect(promotionLineRefund({ ...base, platformFunding: "0", storeFunding: "0", previouslyResolvedQuantity: 0, resolvedQuantityAfter: 1 }).customerRefund).toBe("10.00");
  expect(() => promotionLineRefund({ ...base, originalCharge: "0.10", previouslyResolvedQuantity: 0, resolvedQuantityAfter: 1 })).toThrow("exceed");
});

it("funds an affordable replacement from the customer's original payment while reversing the promotion", () => {
  const input = { originalCharge: "100.00", platformFunding: "6.00", storeFunding: "4.00", originalQuantity: 1, previouslyResolvedQuantity: 0, resolvedQuantityAfter: 1 };
  expect(promotionLineRefund({ ...input, replacementCharge: "50.00" })).toEqual({ sellerBasisRefund: "46.00", customerRefund: "40.00", platformSubsidyReversal: "6.00" });
  expect(promotionLineRefund({ ...input, replacementCharge: "90.00" })).toEqual({ sellerBasisRefund: "6.00", customerRefund: "0.00", platformSubsidyReversal: "6.00" });
  expect(() => promotionLineRefund({ ...input, replacementCharge: "90.01" })).toThrow("exceeds the amount paid");
});
