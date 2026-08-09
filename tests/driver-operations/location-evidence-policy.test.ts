import { describe, expect, it } from "vitest";
import { DriverLocationSampleSchema } from "@/lib/validation/driver-location";

const valid = {
  operationId: "123e4567-e89b-12d3-a456-426614174000",
  assignmentVersion: 1,
  latitude: -33.9249,
  longitude: 18.4241,
  clientCapturedAt: "2026-08-04T10:00:00.000Z",
  source: "DEVICE_GPS",
};

describe("driver location evidence contract", () => {
  it("requires bounded, timestamped coordinates and rejects extra authority fields", () => {
    expect(DriverLocationSampleSchema.safeParse(valid).success).toBe(true);
    expect(DriverLocationSampleSchema.safeParse({ ...valid, orderId: "client-controlled" }).success).toBe(false);
    expect(DriverLocationSampleSchema.safeParse({ ...valid, latitude: 91 }).success).toBe(false);
  });
});
