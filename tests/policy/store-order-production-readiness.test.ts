import { describe, expect, it } from "vitest";
import { assertStoreOrderProductionReady, storeOrderProductionReady } from "@/lib/store-orders/production-lock";
describe("store-order-production-readiness", () => {
  it("fails closed without a source bypass", () => { expect(storeOrderProductionReady()).toBe(false); expect(() => assertStoreOrderProductionReady("HANDOFF")).toThrow("Phase 26.5"); });
  it("allows the explicit test-only approval token", () => expect(() => assertStoreOrderProductionReady("HANDOFF", { approved: true })).not.toThrow());
});
