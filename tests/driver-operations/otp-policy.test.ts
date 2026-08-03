import { describe, expect, it } from "vitest";
import { DELIVERY_OTP_POLICY, isOtpLocked } from "@/lib/driver-operations/otp-policy";

describe("OTP policy", () => {
  it("has a bounded expiry and lock threshold", () => {
    expect(DELIVERY_OTP_POLICY.requiresOtpForDriverCompletion).toBe(true);
    expect(isOtpLocked(5, 5)).toBe(true);
    expect(isOtpLocked(4, 5)).toBe(false);
  });
});
