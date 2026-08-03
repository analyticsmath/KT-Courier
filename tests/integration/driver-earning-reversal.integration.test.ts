import { describe, expect, it } from "vitest";
import { assertDriverEarningTransition } from "@/lib/driver-earnings/driver-earning-state-machine";

describe("driver earning reversal integration", () => {
  it("validates transition from ACCRUED to REVERSED", () => {
    expect(() => assertDriverEarningTransition("ACCRUED", "REVERSED")).not.toThrow();
  });
});
