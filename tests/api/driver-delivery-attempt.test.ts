import { describe, expect, it } from "vitest";
import { DeliveryAttemptedSchema } from "@/lib/validation/delivery";

describe("driver delivery-attempt API contract", () => {
  it("rejects client attempts to authoritatively set delivery-attempt status or retryability", () => {
    const invalidWithAuthority = DeliveryAttemptedSchema.safeParse({
      operationId: "123e4567-e89b-12d3-a456-426614174000",
      assignmentVersion: 1,
      reason: "RECIPIENT_UNAVAILABLE",
      driverNote: "No answer",
      retryable: true,
      status: "FAILED",
    });

    expect(invalidWithAuthority.success).toBe(false);

    const validObservation = DeliveryAttemptedSchema.safeParse({
      operationId: "123e4567-e89b-12d3-a456-426614174000",
      assignmentVersion: 1,
      reason: "RECIPIENT_UNAVAILABLE",
      driverNote: "No answer",
    });

    expect(validObservation.success).toBe(true);
    if (validObservation.success) {
      expect(validObservation.data).not.toHaveProperty("status");
      expect(validObservation.data).not.toHaveProperty("retryable");
    }
  });
});

