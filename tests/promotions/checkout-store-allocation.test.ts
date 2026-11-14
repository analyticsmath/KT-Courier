import { Decimal } from "@prisma/client/runtime/library";
import { expect, it } from "vitest";
import { attachPromotionStoreReferences } from "@/lib/promotions/promotion-allocation-policy";

const allocation = (lineId: string, platform: string, store: string) => ({ lineId, basisAmount: new Decimal(100), discountAmount: new Decimal(platform).plus(store), platformFunding: new Decimal(platform), storeFunding: new Decimal(store) });
const groups = [{ storeReference: "store-a", lines: [{ lineReference: "line-a" }] }, { storeReference: "store-b", lines: [{ lineReference: "line-b" }] }];

it("binds merchandise and delivery discounts to their source stores", () => {
  const result = attachPromotionStoreReferences([allocation("line-a", "3", "2"), allocation("store-b_delivery", "4", "0")], groups);
  expect(result.map(item => item.storeReference)).toEqual(["store-a", "store-b"]);
});

it("rejects unknown or ambiguous allocation sources and unbalanced funding", () => {
  expect(() => attachPromotionStoreReferences([allocation("foreign-line", "3", "2")], groups)).toThrow("no checkout store");
  expect(() => attachPromotionStoreReferences([], [...groups, groups[0]])).toThrow("ambiguous");
  expect(() => attachPromotionStoreReferences([{ ...allocation("line-a", "3", "2"), discountAmount: new Decimal(6) }], groups)).toThrow("does not reconcile");
});
