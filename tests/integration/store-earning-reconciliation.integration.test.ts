import { describe, expect, it } from "vitest";
import { assertStoreEarningTransition } from "@/lib/store-earnings/store-earning-state-machine";

describe("store earning reconciliation integration", () => {
  it("handles transition to RECONCILIATION_REQUIRED", () => {
    expect(() => assertStoreEarningTransition("ACCRUED", "RECONCILIATION_REQUIRED")).not.toThrow();
  });
});
