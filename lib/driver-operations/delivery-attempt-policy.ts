import { DeliveryExceptionReason } from "@/types/db";

const RETRYABLE_REASONS = new Set<DeliveryExceptionReason>([
  DeliveryExceptionReason.RECIPIENT_UNAVAILABLE,
  DeliveryExceptionReason.WRONG_ADDRESS,
  DeliveryExceptionReason.ACCESS_ISSUE,
  DeliveryExceptionReason.OTHER,
]);

export function isRetryableDeliveryFailure(reason: DeliveryExceptionReason): boolean {
  return RETRYABLE_REASONS.has(reason);
}

export function requiresAttemptEvidence(reason: DeliveryExceptionReason): boolean {
  return reason === DeliveryExceptionReason.PARCEL_DAMAGED || reason === DeliveryExceptionReason.SAFETY_ISSUE;
}
