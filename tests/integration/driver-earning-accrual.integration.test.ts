import { describe, expect, it } from "vitest";
import { assertDriverEarningTransition } from "@/lib/driver-earnings/driver-earning-state-machine";
import { assertDriverEarningsProductionReady } from "@/lib/driver-earnings/driver-earning-production-readiness";

describe("driver earning accrual integration", () => {
  it("enforces state transitions for driver earning lifecycle", () => {
    expect(() => assertDriverEarningTransition("ACCRUED", "RELEASED")).not.toThrow();
  });
  it("allows reviewed driver earning execution without a test bypass", () => {
    expect(() => assertDriverEarningsProductionReady({ allowTestOnlyBypass: true })).not.toThrow();
    expect(() => assertDriverEarningsProductionReady()).not.toThrow();
  });
});
