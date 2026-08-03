import { describe, expect, it } from "vitest";
import { assertDriverEarningTransition } from "@/lib/driver-earnings/driver-earning-state-machine";

describe("driver earning release integration", () => {
  it("validates transition from ACCRUED to RELEASED", () => {
    expect(() => assertDriverEarningTransition("ACCRUED", "RELEASED")).not.toThrow();
  });
});
