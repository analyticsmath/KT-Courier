import { describe, expect, it } from "vitest";
import { DeliveryExceptionReason } from "@/types/db";
import { isRetryableDeliveryFailure, requiresAttemptEvidence } from "@/lib/driver-operations/delivery-attempt-policy";

describe("delivery attempt policy", () => {
  it("does not let callers choose retryability", () => {
    expect(isRetryableDeliveryFailure(DeliveryExceptionReason.RECIPIENT_UNAVAILABLE)).toBe(true);
    expect(isRetryableDeliveryFailure(DeliveryExceptionReason.SAFETY_ISSUE)).toBe(false);
  });
  it("requires evidence for damage and safety", () => {
    expect(requiresAttemptEvidence(DeliveryExceptionReason.PARCEL_DAMAGED)).toBe(true);
    expect(requiresAttemptEvidence(DeliveryExceptionReason.ACCESS_ISSUE)).toBe(false);
  });
});
