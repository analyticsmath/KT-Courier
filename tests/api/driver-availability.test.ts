import { describe, expect, it } from "vitest";
import { DriverAvailabilityUpdateSchema } from "@/lib/validation/driver";
describe("PATCH /api/driver/availability contract", () => { it("rejects missing/stale-shape revisions and system values", () => { expect(DriverAvailabilityUpdateSchema.safeParse({ availability:"AVAILABLE" }).success).toBe(false); expect(DriverAvailabilityUpdateSchema.safeParse({ availability:"ON_DELIVERY", expectedRevision:1 }).success).toBe(false); }); });
