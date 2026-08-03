import { describe, expect, it } from "vitest";
import { PAYMENT_ATTEMPT_STATES } from "@/lib/payments/types";
import { PAYMENT_ATTEMPT_TRANSITIONS, assertPaymentAttemptTransition, isPaymentAttemptTerminal } from "@/lib/payments/payment-attempt-state-machine";

describe("payment attempt state machine", () => {
  it("accepts all declared transitions", () => {
    for (const from of PAYMENT_ATTEMPT_STATES) for (const to of PAYMENT_ATTEMPT_TRANSITIONS[from]) expect(() => assertPaymentAttemptTransition(from, to)).not.toThrow();
  });
  it("rejects all undeclared transitions", () => {
    for (const from of PAYMENT_ATTEMPT_STATES) for (const to of PAYMENT_ATTEMPT_STATES) if (from !== to && !PAYMENT_ATTEMPT_TRANSITIONS[from].includes(to)) expect(() => assertPaymentAttemptTransition(from, to)).toThrow();
  });
  it("keeps UNKNOWN unresolved for later proof while terminal finalizations cannot reopen", () => {
    expect(isPaymentAttemptTerminal("UNKNOWN")).toBe(false);
    expect(PAYMENT_ATTEMPT_TRANSITIONS.UNKNOWN).toContain("SUCCEEDED");
    for (const status of ["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"] as const) {
      expect(isPaymentAttemptTerminal(status)).toBe(true);
      expect(PAYMENT_ATTEMPT_TRANSITIONS[status]).toHaveLength(0);
    }
  });
});

