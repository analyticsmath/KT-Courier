import { describe, expect, it } from "vitest";
import { DriverAvailability, DriverStatus } from "@/types/db";
import { canSelectAvailability } from "@/lib/driver-operations/availability-policy";

describe("availability policy", () => {
  it("allows active drivers to choose available or unavailable", () => {
    expect(canSelectAvailability(DriverStatus.ACTIVE, DriverAvailability.AVAILABLE)).toBe(true);
    expect(canSelectAvailability(DriverStatus.ACTIVE, DriverAvailability.UNAVAILABLE)).toBe(true);
  });
  it("blocks inactive profiles and manual ON_DELIVERY", () => {
    expect(canSelectAvailability(DriverStatus.SUSPENDED, DriverAvailability.AVAILABLE)).toBe(false);
    expect(canSelectAvailability(DriverStatus.ACTIVE, DriverAvailability.ON_DELIVERY)).toBe(false);
  });
});
