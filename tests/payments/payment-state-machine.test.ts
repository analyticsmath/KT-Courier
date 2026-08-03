import { describe, expect, it } from "vitest";
import { PAYMENT_STATES, type PaymentState } from "@/lib/payments/types";
import { PAYMENT_TRANSITIONS, assertPaymentTransition, canTransitionPayment } from "@/lib/payments/payment-state-machine";

describe("payment state machine", () => {
  it("accepts every declared transition and same-state idempotent observation", () => {
    for (const from of PAYMENT_STATES) {
      expect(canTransitionPayment(from, from)).toBe(true);
      for (const to of PAYMENT_TRANSITIONS[from]) expect(() => assertPaymentTransition(from, to)).not.toThrow();
    }
  });
  it("rejects every undeclared transition", () => {
    for (const from of PAYMENT_STATES) for (const to of PAYMENT_STATES) {
      if (from !== to && !PAYMENT_TRANSITIONS[from].includes(to)) expect(() => assertPaymentTransition(from, to)).toThrowError(expect.objectContaining({ code: "PAYMENT_STATE_TRANSITION_INVALID" }));
    }
  });
  it.each<[PaymentState, PaymentState]>([["SUCCEEDED", "PROVIDER_PENDING"], ["CANCELLED", "PROVIDER_PENDING"], ["CREATED", "SUCCEEDED"]])("does not allow %s to reopen/jump to %s", (from, to) => expect(canTransitionPayment(from, to)).toBe(false));
  it.each<[PaymentState, PaymentState]>([["FAILED", "PROVIDER_PENDING"], ["EXPIRED", "PROVIDER_PENDING"]])("allows retry path %s to %s", (from, to) => expect(canTransitionPayment(from, to)).toBe(true));
});

