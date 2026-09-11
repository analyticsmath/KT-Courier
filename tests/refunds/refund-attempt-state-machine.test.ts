import { describe, expect, it } from "vitest";
import { assertRefundAttemptTransition, canTransitionRefundAttempt } from "@/lib/refunds/refund-attempt-state-machine";

describe("refund attempt state machine", () => {
  it.each([
    ["RESERVED", "PROCESSING"], ["PROCESSING", "SUCCEEDED"], ["PROCESSING", "FAILED"],
    ["PROCESSING", "UNKNOWN"], ["PROCESSING", "NEEDS_ATTENTION"],
    ["UNKNOWN", "PROCESSING"], ["UNKNOWN", "SUCCEEDED"], ["UNKNOWN", "FAILED"], ["UNKNOWN", "NEEDS_ATTENTION"],
    ["NEEDS_ATTENTION", "PROCESSING"], ["NEEDS_ATTENTION", "FAILED"],
  ] as const)("allows %s -> %s", (from, to) => expect(canTransitionRefundAttempt(from, to)).toBe(true));
  it.each([["RESERVED", "SUCCEEDED"], ["SUCCEEDED", "PROCESSING"], ["FAILED", "PROCESSING"], ["NEEDS_ATTENTION", "RESERVED"]] as const)(
    "rejects %s -> %s", (from, to) => expect(() => assertRefundAttemptTransition(from, to)).toThrow(/cannot transition/i),
  );
});
