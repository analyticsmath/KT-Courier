import { afterEach, describe, expect, it, vi } from "vitest";
import {
  securityEmailAvailable,
  securityEmailUnavailableResponse,
} from "@/lib/auth/security-email-readiness";

describe("security email readiness", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("preserves development OTP behavior", () => {
    expect(securityEmailAvailable({ NODE_ENV: "development" })).toBe(true);
    expect(securityEmailAvailable({ NODE_ENV: "test" })).toBe(true);
  });
  it("does not claim production delivery without credentials or source validation", () => {
    expect(securityEmailAvailable({ NODE_ENV: "production" })).toBe(false);
    expect(
      securityEmailAvailable({
        NODE_ENV: "production",
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "test-credential",
        EMAIL_FROM: "test@example.com",
        NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY: Buffer.alloc(
          32,
          1,
        ).toString("base64"),
      }),
    ).toBe(false);
  });
  it("returns the same safe unavailable response before any account lookup", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = securityEmailUnavailableResponse();
    expect(response?.status).toBe(503);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(await response?.json()).toEqual({
      code: "ACCOUNT_EMAIL_UNAVAILABLE",
      error:
        "Account emails are temporarily unavailable. Please try again later.",
    });
  });
});
