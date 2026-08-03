import { PaymentError } from "./errors";
import type { PaymentAttemptState } from "./types";

export const PAYMENT_ATTEMPT_TRANSITIONS: Readonly<Record<PaymentAttemptState, readonly PaymentAttemptState[]>> = Object.freeze({
  RESERVED: Object.freeze(["REQUESTING", "FAILED", "CANCELLED", "EXPIRED"] as const),
  REQUESTING: Object.freeze(["REQUIRES_ACTION", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED", "UNKNOWN"] as const),
  REQUIRES_ACTION: Object.freeze(["PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED", "UNKNOWN"] as const),
  PROCESSING: Object.freeze(["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED", "UNKNOWN"] as const),
  UNKNOWN: Object.freeze(["PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"] as const),
  SUCCEEDED: Object.freeze([] as const),
  FAILED: Object.freeze([] as const),
  CANCELLED: Object.freeze([] as const),
  EXPIRED: Object.freeze([] as const),
});

export const TERMINAL_PAYMENT_ATTEMPT_STATES = Object.freeze([
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const);

export function canTransitionPaymentAttempt(from: PaymentAttemptState, to: PaymentAttemptState): boolean {
  return from === to || PAYMENT_ATTEMPT_TRANSITIONS[from].includes(to);
}

export function assertPaymentAttemptTransition(from: PaymentAttemptState, to: PaymentAttemptState): void {
  if (!canTransitionPaymentAttempt(from, to)) {
    throw new PaymentError(
      "PAYMENT_ATTEMPT_TRANSITION_INVALID",
      `Payment attempt cannot transition from ${from} to ${to}.`,
    );
  }
}

export function isPaymentAttemptTerminal(status: PaymentAttemptState): boolean {
  return TERMINAL_PAYMENT_ATTEMPT_STATES.includes(status as (typeof TERMINAL_PAYMENT_ATTEMPT_STATES)[number]);
}

