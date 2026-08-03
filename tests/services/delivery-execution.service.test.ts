import { describe, expect, it } from "vitest";
import { DeliveryExceptionReason } from "@/types/db";
import { isRetryableDeliveryFailure, requiresAttemptEvidence } from "@/lib/driver-operations/delivery-attempt-policy";

describe("delivery execution service contract", () => {
  it("owns retryability and evidence requirements on the server", () => {
    expect(isRetryableDeliveryFailure(DeliveryExceptionReason.RECIPIENT_UNAVAILABLE)).toBe(true);
    expect(isRetryableDeliveryFailure(DeliveryExceptionReason.SAFETY_ISSUE)).toBe(false);
    expect(requiresAttemptEvidence(DeliveryExceptionReason.PARCEL_DAMAGED)).toBe(true);
  });
});
