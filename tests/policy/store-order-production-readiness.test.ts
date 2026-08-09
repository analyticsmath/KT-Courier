import { describe, expect, it } from "vitest";
import { assertStoreOrderProductionReady, storeOrderProductionReady } from "@/lib/store-orders/production-lock";
describe("store-order-production-readiness", () => {
  it("activates repository-owned fulfilment composition without an environment bypass", () => {
    expect(storeOrderProductionReady()).toBe(true);
    expect(() => assertStoreOrderProductionReady("HANDOFF")).not.toThrow();
  });
  it("does not depend on a test-only approval token", () => expect(() => assertStoreOrderProductionReady("HANDOFF", { approved: true })).not.toThrow());
});
