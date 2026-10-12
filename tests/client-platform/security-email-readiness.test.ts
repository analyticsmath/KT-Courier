import { afterEach, describe, expect, it, vi } from "vitest";
import {
  securityEmailAvailable,
  securityEmailUnavailableResponse,
  shouldQueueSecurityEmail,
} from "@/lib/auth/security-email-readiness";

describe("security email readiness", () => {
  const offline = { NODE_ENV: "test", KT_E2E_PAYSTACK_ACCEPTANCE: "true", KT_RUNTIME_ENV: "e2e", KT_NETWORK_DISABLED: "true", KT_E2E_NETWORK_INTERNAL: "true", KT_LOCAL_FULL_FLOW: "false", PAYSTACK_MODE: "test", PAYSTACK_SECRET_KEY: "sk_test_disposable_browser_no_provider", DATABASE_URL: "postgresql://kt_phase75_e2e:synthetic@localhost:5432/kt_phase75_e2e", PAYMENT_APP_ORIGIN: "http://localhost:3200", EMAIL_PROVIDER: "console", NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") };
  it("queues encrypted security intents only for the exact isolated test inbox", () => {
    expect(shouldQueueSecurityEmail(offline)).toBe(true);
    for (const changed of [{ KT_NETWORK_DISABLED: "false" }, { KT_E2E_NETWORK_INTERNAL: "false" }, { KT_RUNTIME_ENV: "production" }, { NODE_ENV: "development" }, { DATABASE_URL: "postgresql://foreign@localhost:5432/shared" }, { NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY: "" }]) expect(shouldQueueSecurityEmail({ ...offline, ...changed })).toBe(false);
    expect(shouldQueueSecurityEmail({ NODE_ENV: "test", EMAIL_PROVIDER: "console" })).toBe(false);
  });
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
