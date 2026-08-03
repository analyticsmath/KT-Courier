import { RefundError } from "./errors";
import type { RefundAttemptStatusCode } from "./types";

const ATTEMPT_TRANSITIONS: Readonly<Record<RefundAttemptStatusCode, readonly RefundAttemptStatusCode[]>> = Object.freeze({
  RESERVED: Object.freeze(["PROCESSING"] as const),
  PROCESSING: Object.freeze(["SUCCEEDED", "FAILED", "UNKNOWN"] as const),
  UNKNOWN: Object.freeze(["PROCESSING", "SUCCEEDED", "FAILED"] as const),
  SUCCEEDED: Object.freeze([] as const),
  FAILED: Object.freeze([] as const),
});

export function canTransitionRefundAttempt(from: RefundAttemptStatusCode, to: RefundAttemptStatusCode): boolean {
  return ATTEMPT_TRANSITIONS[from].includes(to);
}

export function assertRefundAttemptTransition(from: RefundAttemptStatusCode, to: RefundAttemptStatusCode): void {
  if (!canTransitionRefundAttempt(from, to)) {
    throw new RefundError("REFUND_INVALID_STATE", `Refund attempt cannot transition from ${from} to ${to}.`);
  }
}

