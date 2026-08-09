import { describe, expect, it } from "vitest";
import { STORE_ORDER_PRODUCTION_VALIDATION_APPROVED, assertStoreOrderProductionReady } from "@/lib/store-orders/production-lock";
describe("store-order service source lock", () => {
  it("does not retain a broad pre-production source lock after concrete composition", () => {
    expect(STORE_ORDER_PRODUCTION_VALIDATION_APPROVED).toBe(true);
    expect(() => assertStoreOrderProductionReady("DELIVERY_BRIDGE")).not.toThrow();
  });
});
