import { describe, expect, it } from "vitest";
import { StartDeliverySchema } from "@/lib/validation/delivery";
describe("delivery resume API contract", () => { it("uses the same strict command payload as transit", () => { expect(StartDeliverySchema.safeParse({ operationId:"123e4567-e89b-12d3-a456-426614174000", assignmentVersion:1 }).success).toBe(true); }); });
