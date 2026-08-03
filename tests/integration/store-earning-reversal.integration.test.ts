import { describe, expect, it } from "vitest";
import { assertStoreEarningTransition } from "@/lib/store-earnings/store-earning-state-machine";

describe("store earning reversal integration", () => {
  it("validates transition from ACCRUED to REVERSED", () => {
    expect(() => assertStoreEarningTransition("ACCRUED", "REVERSED")).not.toThrow();
  });
});
