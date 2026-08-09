import { describe, expect, it } from "vitest";
import { CompleteDeliverySchema } from "@/lib/validation/delivery";

describe("delivery completion API contract", () => {
  it("rejects client timestamps, status fields, and direct coordinates", () => {
    const base = { operationId: "123e4567-e89b-12d3-a456-426614174000", assignmentVersion: 1, otpCode: "123456", recipientName: "R", driverNote: "Delivered to recipient.", confirmDelivery: true };
    expect(CompleteDeliverySchema.safeParse({ ...base, deliveredAt: "2020-01-01T00:00:00.000Z", status: "COMPLETED" }).success).toBe(false);
    expect(CompleteDeliverySchema.safeParse({ ...base, latitude: -33.9249, longitude: 18.4241 }).success).toBe(false);
  });
});
