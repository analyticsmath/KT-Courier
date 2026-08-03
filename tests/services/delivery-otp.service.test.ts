import { describe, expect, it } from "vitest";
import { DELIVERY_OTP_POLICY, isOtpLocked } from "@/lib/driver-operations/otp-policy";

describe("delivery OTP service contract", () => {
  it("uses hash-only policy with bounded retries", () => {
    expect(DELIVERY_OTP_POLICY.expiresInMinutes).toBe(30);
    expect(isOtpLocked(DELIVERY_OTP_POLICY.maxAttempts, DELIVERY_OTP_POLICY.maxAttempts)).toBe(true);
  });
});
