import { describe, expect, it } from "vitest";
import { assertWithdrawalTransition } from "@/lib/withdrawals/withdrawal-state-machine";

describe("withdrawal reconciliation integration", () => {
  it("handles state transitions for reconciliation cases", () => {
    expect(() => assertWithdrawalTransition("PROCESSING", "RECONCILIATION_REQUIRED")).not.toThrow();
  });
});
