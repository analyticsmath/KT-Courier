import { describe, expect, it } from "vitest";
import { DeliveryAttemptedSchema } from "@/lib/validation/delivery";
describe("delivery attempt API contract", () => { it("does not accept client status or retryability", () => { const parsed = DeliveryAttemptedSchema.safeParse({ operationId:"123e4567-e89b-12d3-a456-426614174000", assignmentVersion:1, reason:"RECIPIENT_UNAVAILABLE", driverNote:"No answer", retryable:false, status:"FAILED" }); expect(parsed.success).toBe(true); if (parsed.success) expect(parsed.data).not.toHaveProperty("retryable"); }); });
