import { describe, expect, it } from "vitest";
import { requiresSenderPickupOtp } from "@/lib/driver-operations/pickup-otp-rollout";

describe("sender pickup OTP activation without stranding booked parcels", () => {
  const activation = "2026-10-24T00:00:00.000Z";
  it("does not retroactively change orders placed before activation", () => {
    expect(requiresSenderPickupOtp(new Date("2026-10-23T23:59:59.999Z"), { enabled: "true", effectiveFrom: activation })).toBe(false);
  });
  it("requires the sender code for all new parcels from the activation instant", () => {
    expect(requiresSenderPickupOtp(new Date(activation), { enabled: "true", effectiveFrom: activation })).toBe(true);
    expect(requiresSenderPickupOtp(new Date("2026-10-24T00:01:00.000Z"), { enabled: "true", effectiveFrom: activation })).toBe(true);
  });
  it("does not activate from an incomplete or malformed rollout configuration", () => {
    const created = new Date("2026-10-24T01:00:00.000Z");
    expect(requiresSenderPickupOtp(created, { enabled: "false", effectiveFrom: activation })).toBe(false);
    expect(requiresSenderPickupOtp(created, { enabled: "true" })).toBe(false);
    expect(requiresSenderPickupOtp(created, { enabled: "true", effectiveFrom: "not-a-date" })).toBe(false);
  });
});
