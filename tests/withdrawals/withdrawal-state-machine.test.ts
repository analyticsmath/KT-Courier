import { describe, expect, it } from "vitest";
import { assertWithdrawalTransition, canTransitionWithdrawal, isWithdrawalTerminal } from "@/lib/withdrawals/withdrawal-state-machine";

describe("withdrawal state machine", () => {
  it("allows only the declared financial lifecycle transitions", () => {
    expect(canTransitionWithdrawal("REQUESTED", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionWithdrawal("PROCESSING", "RECONCILIATION_REQUIRED")).toBe(true);
    expect(canTransitionWithdrawal("RECONCILIATION_REQUIRED", "PAID")).toBe(true);
    expect(canTransitionWithdrawal("PAID", "APPROVED")).toBe(false);
    expect(isWithdrawalTerminal("PAID")).toBe(true);
  });
  it("rejects invalid and terminal reopen transitions", () => {
    expect(() => assertWithdrawalTransition("APPROVED", "PAID")).toThrow("cannot transition");
    expect(() => assertWithdrawalTransition("CANCELLED", "APPROVED")).toThrow("cannot transition");
  });
});
