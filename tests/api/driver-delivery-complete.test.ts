import { describe, expect, it } from "vitest";
import { CompleteDeliverySchema } from "@/lib/validation/delivery";
describe("delivery completion API contract", () => { it("does not allow client timestamps or status fields", () => { const parsed = CompleteDeliverySchema.safeParse({ operationId:"123e4567-e89b-12d3-a456-426614174000", assignmentVersion:1, otpCode:"123456", recipientName:"R", confirmDelivery:true, deliveredAt:"2020-01-01T00:00:00.000Z", status:"COMPLETED" }); expect(parsed.success).toBe(true); if (parsed.success) expect(parsed.data).not.toHaveProperty("deliveredAt"); }); });
