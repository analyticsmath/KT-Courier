import { describe, expect, it } from "vitest";
import { assertDriverEarningTransition } from "@/lib/driver-earnings/driver-earning-state-machine";

describe("driver earning reconciliation integration", () => {
  it("handles transition to RECONCILIATION_REQUIRED", () => {
    expect(() => assertDriverEarningTransition("ACCRUED", "RECONCILIATION_REQUIRED")).not.toThrow();
  });
});
