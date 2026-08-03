import { describe, expect, it } from "vitest";
import { driverOperationRequestHash } from "@/lib/driver-operations/idempotency";

describe("pickup custody service command contract", () => {
  it("hashes material pickup fields deterministically", () => {
    expect(driverOperationRequestHash({ operationId: "x", assignmentVersion: 1, parcelCount: 1 })).toBe(driverOperationRequestHash({ parcelCount: 1, assignmentVersion: 1, operationId: "x" }));
  });
});
