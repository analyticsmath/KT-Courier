import { describe, expect, it } from "vitest";
import { assertStoreEarningTransition } from "@/lib/store-earnings/store-earning-state-machine";

describe("store earning refund integration", () => {
  it("validates transition from ACCRUED to FULLY_REFUNDED", () => {
    expect(() => assertStoreEarningTransition("ACCRUED", "FULLY_REFUNDED")).not.toThrow();
  });
});
