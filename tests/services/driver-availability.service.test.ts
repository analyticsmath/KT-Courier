import { describe, expect, it } from "vitest";
import { DriverAvailability, DriverStatus } from "@/types/db";
import { DriverAvailabilityUpdateSchema } from "@/lib/validation/driver";
import { canSelectAvailability } from "@/lib/driver-operations/availability-policy";

describe("driver availability service contract", () => {
  it("requires expectedRevision and rejects system-only availability", () => {
    expect(DriverAvailabilityUpdateSchema.safeParse({ availability: DriverAvailability.AVAILABLE }).success).toBe(false);
    expect(DriverAvailabilityUpdateSchema.safeParse({ availability: DriverAvailability.ON_DELIVERY, expectedRevision: 1 }).success).toBe(false);
  });
  it("allows active preferences without changing accepted-work authority", () => {
    expect(canSelectAvailability(DriverStatus.ACTIVE, DriverAvailability.UNAVAILABLE)).toBe(true);
    expect(canSelectAvailability(DriverStatus.INACTIVE, DriverAvailability.AVAILABLE)).toBe(false);
  });
});
