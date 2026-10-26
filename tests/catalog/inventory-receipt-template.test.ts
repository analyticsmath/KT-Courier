import { expect, it } from "vitest";
import { inventoryReceiptTemplate } from "@/lib/catalog/inventory-receipt-template";
const primary = { publicReference: "primary", status: "ACTIVE", isPrimary: true };
const other = { publicReference: "other", status: "ACTIVE" };
const item = { publicReference: "inventory", trackingMode: "TRACKED", version: 2, levels: [] };
it("allows the first receipt for a zero-stock product at the store's active primary location", () => {
  expect(inventoryReceiptTemplate([item], [other, primary])).toEqual([{ inventoryReference: "inventory", locationReference: "primary", version: 2 }]);
});
it("preserves an existing active location and excludes untracked inventory", () => {
  expect(inventoryReceiptTemplate([{ ...item, levels: [{ location: other }] }, { ...item, trackingMode: "UNTRACKED" }], [primary, other])).toEqual([{ inventoryReference: "inventory", locationReference: "other", version: 2 }]);
});
it("does not use inactive or no-longer-owned locations", () => {
  expect(inventoryReceiptTemplate([{ ...item, levels: [{ location: other }] }], [{ ...primary, status: "INACTIVE" }])).toEqual([]);
  expect(inventoryReceiptTemplate([{ ...item, levels: [{ location: other }] }], [primary])[0]?.locationReference).toBe("primary");
});
