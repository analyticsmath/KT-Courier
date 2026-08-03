import { describe, expect, it } from "vitest";
import { assertExternalPayoutReference } from "@/lib/withdrawals/payout-reference-policy";
import { assertPayoutAttemptTransition } from "@/lib/withdrawals/payout-attempt-state-machine";

describe("withdrawal payout integration", () => {
  it("validates external payout reference formatting and state transitions", () => {
    expect(() => assertExternalPayoutReference("manual-bank:ref-abc123")).not.toThrow();
    expect(() => assertPayoutAttemptTransition("RESERVED", "PROCESSING")).not.toThrow();
  });
});
