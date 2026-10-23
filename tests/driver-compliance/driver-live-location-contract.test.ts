import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DriverLocationSampleSchema } from "@/lib/validation/driver-location";

const client = readFileSync(
  new URL("../../components/driver/DriverLiveLocationSharing.tsx", import.meta.url),
  "utf8",
);

const valid = {
  operationId: "b2fbe082-e3b8-4e2d-bd3a-042db4d9e49c",
  assignmentVersion: 1,
  latitude: -26.2041,
  longitude: 28.0473,
  clientCapturedAt: "2026-10-23T17:20:00.000Z",
  accuracyMeters: 12,
  source: "DEVICE_GPS",
};

describe("foreground driver GPS request contract", () => {
  it("sends a bare UUID for the server's strict operation ID validator", () => {
    expect(client).toMatch(/operationId:\s*crypto\.randomUUID\(\)/);
    expect(client).not.toMatch(/driver-gps-/);
  });

  it("accepts an ordinary device location sample with a UUID operation ID", () => {
    expect(DriverLocationSampleSchema.safeParse(valid).success).toBe(true);
  });

  it("reproduces the live 400: prefixed UUIDs are rejected at validation", () => {
    expect(DriverLocationSampleSchema.safeParse({
      ...valid,
      operationId: `driver-gps-${valid.operationId}`,
    }).success).toBe(false);
  });

  it("keeps strict location accuracy, coordinates, source and assignment guards", () => {
    expect(DriverLocationSampleSchema.safeParse({ ...valid, latitude: 91 }).success).toBe(false);
    expect(DriverLocationSampleSchema.safeParse({ ...valid, accuracyMeters: -1 }).success).toBe(false);
    expect(DriverLocationSampleSchema.safeParse({ ...valid, source: "UNTRUSTED" }).success).toBe(false);
    expect(DriverLocationSampleSchema.safeParse({ ...valid, assignmentVersion: 0 }).success).toBe(false);
  });
});
