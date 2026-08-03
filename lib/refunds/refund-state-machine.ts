import { RefundError } from "./errors";
import type { RefundStatusCode } from "./types";

const TRANSITIONS: Readonly<Record<RefundStatusCode, readonly RefundStatusCode[]>> = Object.freeze({
  REQUESTED: Object.freeze(["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"] as const),
  UNDER_REVIEW: Object.freeze(["APPROVED", "REJECTED", "CANCELLED"] as const),
  APPROVED: Object.freeze(["PROCESSING", "SUCCEEDED", "CANCELLED"] as const),
  PROCESSING: Object.freeze(["SUCCEEDED", "APPROVED", "RECONCILIATION_REQUIRED"] as const),
  RECONCILIATION_REQUIRED: Object.freeze(["PROCESSING", "SUCCEEDED", "CANCELLED"] as const),
  SUCCEEDED: Object.freeze([] as const),
  REJECTED: Object.freeze([] as const),
  CANCELLED: Object.freeze([] as const),
});

export const RESERVED_REFUND_STATUSES = Object.freeze([
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PROCESSING",
  "RECONCILIATION_REQUIRED",
] as const);

export const TERMINAL_REFUND_STATUSES = Object.freeze(["SUCCEEDED", "REJECTED", "CANCELLED"] as const);

export function canTransitionRefund(from: RefundStatusCode, to: RefundStatusCode): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertRefundTransition(from: RefundStatusCode, to: RefundStatusCode): void {
  if (!canTransitionRefund(from, to)) {
    throw new RefundError("REFUND_INVALID_STATE", `Refund cannot transition from ${from} to ${to}.`);
  }
}

export function isReservedRefundStatus(status: string): status is (typeof RESERVED_REFUND_STATUSES)[number] {
  return (RESERVED_REFUND_STATUSES as readonly string[]).includes(status);
}

