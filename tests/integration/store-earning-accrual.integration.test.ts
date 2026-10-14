import { describe, expect, it } from "vitest";
import { assertStoreEarningTransition } from "@/lib/store-earnings/store-earning-state-machine";
import { assertStoreEarningsProductionReady } from "@/lib/store-earnings/store-earning-production-readiness";

describe("store earning accrual integration", () => {
  it("enforces state transitions for store earning lifecycle", () => {
    expect(() => assertStoreEarningTransition("ACCRUED", "RELEASED")).not.toThrow();
  });
  it("allows reviewed store earning execution without a test bypass", () => {
    expect(() => assertStoreEarningsProductionReady({ allowTestOnlyBypass: true })).not.toThrow();
    expect(() => assertStoreEarningsProductionReady()).not.toThrow();
  });
});
