import { describe, expect, it } from "vitest";
import { CompletePickupSchema } from "@/lib/validation/pickup";
describe("pickup confirmation API contract", () => { it("requires UUID operation ID and assignment version", () => { expect(CompletePickupSchema.safeParse({ parcelCount:1, parcelCondition:"GOOD", confirmPickup:true }).success).toBe(false); expect(CompletePickupSchema.safeParse({ operationId:"bad", assignmentVersion:1, parcelCount:1, parcelCondition:"GOOD", confirmPickup:true }).success).toBe(false); }); });
