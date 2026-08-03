import { describe, expect, it } from "vitest";
import { assertAcceptanceTransition, assertPreparationTransition, deriveStoreOrderStatus } from "@/lib/store-orders/state-machine";

describe("store-order-state-policy", () => {
  it("makes acceptance irreversible", () => {
    expect(() => assertAcceptanceTransition("ACCEPTED", "REJECTED")).toThrow("cannot transition");
    expect(() => assertAcceptanceTransition("REVIEWING", "ACCEPTED")).not.toThrow();
  });
  it("keeps preparation separate from acceptance", () => {
    expect(() => assertPreparationTransition("NOT_STARTED", "PREPARING")).not.toThrow();
    expect(() => assertPreparationTransition("HANDED_OFF", "PREPARING")).toThrow("cannot transition");
  });
  it("derives instead of accepting an arbitrary overall status", () => {
    expect(deriveStoreOrderStatus({ acceptance: "ACCEPTED", preparation: "READY_FOR_HANDOFF", resolution: "CLEAR", delivery: "HANDOFF_READY" })).toBe("HANDOFF_IN_PROGRESS");
    expect(deriveStoreOrderStatus({ acceptance: "ACCEPTED", preparation: "PREPARING", resolution: "RECONCILIATION_REQUIRED", delivery: "DISPATCH_PENDING" })).toBe("RECONCILIATION_REQUIRED");
  });
});
