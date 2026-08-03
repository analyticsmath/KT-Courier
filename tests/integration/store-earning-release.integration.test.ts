import { describe, expect, it } from "vitest";
import { assertStoreEarningTransition } from "@/lib/store-earnings/store-earning-state-machine";

describe("store earning release integration", () => {
  it("validates transition from ACCRUED to RELEASED", () => {
    expect(() => assertStoreEarningTransition("ACCRUED", "RELEASED")).not.toThrow();
  });
});
