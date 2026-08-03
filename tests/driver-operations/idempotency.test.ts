import { describe, expect, it } from "vitest";
import { driverOperationRequestHash } from "@/lib/driver-operations/idempotency";

describe("driver operation request hashes", () => {
  it("is stable for equivalent payloads and changes for changed data", () => {
    expect(driverOperationRequestHash({ b: 2, a: 1 })).toBe(driverOperationRequestHash({ a: 1, b: 2 }));
    expect(driverOperationRequestHash({ a: 1 })).not.toBe(driverOperationRequestHash({ a: 2 }));
  });
});
