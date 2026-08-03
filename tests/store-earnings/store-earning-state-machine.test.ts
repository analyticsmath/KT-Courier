import { describe, expect, it } from "vitest";
import { assertStoreEarningTransition, isTerminalStoreEarningStatus } from "@/lib/store-earnings/store-earning-state-machine";

describe("store earning state machine", () => {
  it.each([["ACCRUED", "RELEASED"], ["ACCRUED", "FULLY_REFUNDED"], ["ACCRUED", "REVERSED"], ["ACCRUED", "RECONCILIATION_REQUIRED"], ["RECONCILIATION_REQUIRED", "ACCRUED"]] as const)("allows %s to %s", (from, to) => expect(() => assertStoreEarningTransition(from, to)).not.toThrow());
  it.each(["RELEASED", "FULLY_REFUNDED", "REVERSED"] as const)("keeps %s terminal", (status) => {
    expect(isTerminalStoreEarningStatus(status)).toBe(true);
    expect(() => assertStoreEarningTransition(status, "ACCRUED")).toThrow();
  });
});
