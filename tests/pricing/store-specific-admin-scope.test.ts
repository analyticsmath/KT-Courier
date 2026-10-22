import { describe, expect, it } from "vitest";
import { limitPricingToStore } from "@/lib/pricing/store-specific-admin-scope";

const owners = [
  { type: "STORE", id: "store-abc", label: "Store: ABC Pty" },
  { type: "STORE", id: "store-other", label: "Store: Other Ltd" },
  { type: "CUSTOMER", id: "user-1", label: "Customer" },
];
const rates = [
  { ownerType: "STORE", ownerId: "store-abc", baseFee: "170.00", perKmRate: "0.0000" },
  { ownerType: "STORE", ownerId: "store-other", baseFee: "89.00", perKmRate: "2.0000" },
  { ownerType: "CUSTOMER", ownerId: "user-1", baseFee: "99.00", perKmRate: "1.0000" },
];
describe("store-specific pricing administration", () => {
  it("shows only the selected store and its rate without changing any other store", () => {
    const scope = limitPricingToStore("store-abc", { id: "store-abc", name: "ABC Pty", status: "ACTIVE" }, owners, rates);
    expect(scope.owners).toEqual([{ type: "STORE", id: "store-abc", label: "Store: ABC Pty" }]);
    expect(scope.rates).toEqual([rates[0]]);
    expect(rates[1].baseFee).toBe("89.00");
  });
  it("does not switch to global administration for an invalid store", () => {
    expect(limitPricingToStore("missing", null, owners, rates)).toEqual({ owners: [], rates: [] });
  });
  it("rejects inactive stores and mismatched server-resolved IDs", () => {
    expect(limitPricingToStore("store-abc", { id: "store-abc", name: "ABC Pty", status: "SUSPENDED" }, owners, rates).owners).toEqual([]);
    expect(limitPricingToStore("store-abc", { id: "store-other", name: "Other", status: "ACTIVE" }, owners, rates).rates).toEqual([]);
  });
  it("preserves standard pricing administration without a store filter", () => {
    expect(limitPricingToStore(undefined, null, owners, rates)).toEqual({ owners, rates });
  });
});
