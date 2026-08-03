import { describe, expect, it } from "vitest";
import { assertRefundAttemptTransition, canTransitionRefundAttempt } from "@/lib/refunds/refund-attempt-state-machine";

describe("refund attempt state machine", () => {
  it.each([
    ["RESERVED", "PROCESSING"], ["PROCESSING", "SUCCEEDED"], ["PROCESSING", "FAILED"],
    ["PROCESSING", "UNKNOWN"], ["UNKNOWN", "PROCESSING"], ["UNKNOWN", "SUCCEEDED"], ["UNKNOWN", "FAILED"],
  ] as const)("allows %s -> %s", (from, to) => expect(canTransitionRefundAttempt(from, to)).toBe(true));
  it.each([["RESERVED", "SUCCEEDED"], ["SUCCEEDED", "PROCESSING"], ["FAILED", "PROCESSING"]] as const)(
    "rejects %s -> %s", (from, to) => expect(() => assertRefundAttemptTransition(from, to)).toThrow(/cannot transition/i),
  );
});
