import { expect, it } from "vitest";
import { cents, frozenRefundAllocation } from "@/lib/store-orders/allocation";

it("reverses only an approved substitute price difference from frozen evidence", () => {
  expect(frozenRefundAllocation({ sellerBasis: "1500.00", commission: "150.00", storeEarning: "1350.00", includedTax: "195.65", priorRefund: "0.00", refund: "1100.00" })).toEqual({ SELLER_BASIS: "1100.00", COMMISSION: "110.00", STORE_EARNING: "990.00", taxAmount: "143.47" });
});
it("conserves each cent and the full frozen commission across repeated partial refunds", () => {
  let commission = BigInt(0), earning = BigInt(0), tax = BigInt(0);
  for (let prior = 0; prior < 7; prior++) {
    const allocation = frozenRefundAllocation({ sellerBasis: "0.07", commission: "0.02", storeEarning: "0.05", includedTax: "0.01", priorRefund: `0.0${prior}`, refund: "0.01" });
    commission += cents(allocation.COMMISSION); earning += cents(allocation.STORE_EARNING); tax += cents(allocation.taxAmount);
    expect(cents(allocation.COMMISSION) + cents(allocation.STORE_EARNING)).toBe(BigInt(1));
  }
  expect([commission, earning, tax]).toEqual([BigInt(2), BigInt(5), BigInt(1)]);
});
it("equal-price substitution leaves every financial allocation unchanged", () => {
  expect(frozenRefundAllocation({ sellerBasis: "1500.00", commission: "150.00", storeEarning: "1350.00", includedTax: "0.00", priorRefund: "0.00", refund: "0.00" })).toEqual({ SELLER_BASIS: "0.00", COMMISSION: "0.00", STORE_EARNING: "0.00", taxAmount: "0.00" });
});
it("preserves a wholly zero-valued frozen line without division", () => {
  expect(frozenRefundAllocation({ sellerBasis: "0.00", commission: "0.00", storeEarning: "0.00", includedTax: "0.00", priorRefund: "0.00", refund: "0.00" })).toEqual({ SELLER_BASIS: "0.00", COMMISSION: "0.00", STORE_EARNING: "0.00", taxAmount: "0.00" });
});
it.each([{ refund: "1500.01" }, { commission: "150.01" }, { includedTax: "1500.01" }, { priorRefund: "1500.00", refund: "0.01" }])("rejects incoherent or over-ceiling immutable evidence %j", changed => {
  expect(() => frozenRefundAllocation({ sellerBasis: "1500.00", commission: "150.00", storeEarning: "1350.00", includedTax: "0.00", priorRefund: "0.00", refund: "1100.00", ...changed })).toThrow("immutable financial evidence");
});
