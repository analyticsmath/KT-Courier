import { PaymentError } from "./errors";
import type { PaymentState } from "./types";

export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentState, readonly PaymentState[]>> = Object.freeze({
  CREATED: Object.freeze(["PROVIDER_PENDING"] as const),
  PROVIDER_PENDING: Object.freeze(["REQUIRES_ACTION", "PROCESSING", "FAILED", "EXPIRED", "CANCELLED"] as const),
  REQUIRES_ACTION: Object.freeze(["PROCESSING", "SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED"] as const),
  PROCESSING: Object.freeze(["SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED"] as const),
  SUCCEEDED: Object.freeze([] as const),
  FAILED: Object.freeze(["PROVIDER_PENDING"] as const),
  CANCELLED: Object.freeze([] as const),
  EXPIRED: Object.freeze(["PROVIDER_PENDING"] as const),
});

export const TERMINAL_PAYMENT_STATES = Object.freeze(["SUCCEEDED", "CANCELLED"] as const);
export const RETRYABLE_PAYMENT_STATES = Object.freeze(["FAILED", "EXPIRED"] as const);

export function canTransitionPayment(from: PaymentState, to: PaymentState): boolean {
  return from === to || PAYMENT_TRANSITIONS[from].includes(to);
}

export function assertPaymentTransition(from: PaymentState, to: PaymentState): void {
  if (!canTransitionPayment(from, to)) {
    throw new PaymentError(
      "PAYMENT_STATE_TRANSITION_INVALID",
      `Payment cannot transition from ${from} to ${to}.`,
    );
  }
}

export function isPaymentRetryable(status: PaymentState): boolean {
  return RETRYABLE_PAYMENT_STATES.includes(status as (typeof RETRYABLE_PAYMENT_STATES)[number]);
}

