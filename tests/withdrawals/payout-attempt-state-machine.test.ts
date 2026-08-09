import { describe, expect, it } from "vitest";
import {
  canTransitionPayoutAttempt,
  assertPayoutAttemptTransition,
  PAYOUT_ATTEMPT_STATUSES,
} from "@/lib/withdrawals/payout-attempt-state-machine";

describe("payout attempt state machine", () => {
  it("covers reserved, processing, failed, unknown, and succeeded transitions", () => {
    expect(PAYOUT_ATTEMPT_STATUSES).toEqual(["RESERVED", "PROCESSING", "SUCCEEDED", "FAILED", "UNKNOWN"]);

    expect(canTransitionPayoutAttempt("RESERVED", "PROCESSING")).toBe(true);
    expect(canTransitionPayoutAttempt("PROCESSING", "SUCCEEDED")).toBe(true);
    expect(canTransitionPayoutAttempt("PROCESSING", "FAILED")).toBe(true);
    expect(canTransitionPayoutAttempt("PROCESSING", "UNKNOWN")).toBe(true);

    expect(canTransitionPayoutAttempt("SUCCEEDED", "PROCESSING")).toBe(false);
    expect(canTransitionPayoutAttempt("FAILED", "SUCCEEDED")).toBe(false);
    expect(canTransitionPayoutAttempt("UNKNOWN", "SUCCEEDED")).toBe(false);

    expect(() => assertPayoutAttemptTransition("RESERVED", "PROCESSING")).not.toThrow();
    expect(() => assertPayoutAttemptTransition("SUCCEEDED", "PROCESSING")).toThrowError(/cannot transition/);
  });
});
