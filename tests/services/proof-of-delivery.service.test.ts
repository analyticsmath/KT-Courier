import { describe, expect, it } from "vitest";
import { CompleteDeliverySchema } from "@/lib/validation/delivery";

describe("proof-of-delivery safety", () => {
  it("rejects arbitrary URL evidence references", () => {
    const input = { operationId: "123e4567-e89b-12d3-a456-426614174000", assignmentVersion: 1, otpCode: "123456", recipientName: "Recipient", confirmDelivery: true, evidenceReference: "https://unsafe.example/pod" };
    expect(CompleteDeliverySchema.safeParse(input).success).toBe(false);
  });
});
