import { describe, expect, it } from "vitest";
import { assertDriverEarningTransition } from "@/lib/driver-earnings/driver-earning-state-machine";

describe("driver earning refund integration", () => {
  it("validates transition from ACCRUED to FULLY_REFUNDED", () => {
    expect(() => assertDriverEarningTransition("ACCRUED", "FULLY_REFUNDED")).not.toThrow();
  });
});
