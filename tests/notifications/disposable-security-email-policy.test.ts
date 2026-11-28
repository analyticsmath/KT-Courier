import { describe, expect, it } from "vitest";
import {
  isDisposableSecurityEmailRuntime,
  isQaOperationalE2eSecurityEmailRuntime,
  sendDisposableSecurityEmail,
} from "@/lib/testing/disposable-security-email-policy";

const safe = {
  NODE_ENV: "production",
  KT_RUNTIME_ENV: "e2e",
  KT_NETWORK_DISABLED: "true",
  KT_E2E_NETWORK_INTERNAL: "true",
  KT_E2E_PAYSTACK_ACCEPTANCE: "true",
  KT_LOCAL_FULL_FLOW: "false",
  PAYSTACK_MODE: "test",
  PAYSTACK_SECRET_KEY: "sk_test_disposable_browser_no_provider",
  EMAIL_PROVIDER: "console",
  RESEND_API_KEY: "",
  DATABASE_URL: "postgresql://kt_phase75_e2e:disposable_only@db:5432/kt_phase75_e2e?schema=public",
  PAYMENT_APP_ORIGIN: "http://localhost:3333",
};
const message = {
  destination: "e2e-paystack-driver-test@ktcouriers.local",
  subject: "Your six-digit delivery code",
  body: "Disposable recipient verification",
  idempotencyKey: "idempotency-test",
};

describe("disposable offline security mail without production bypass", () => {
  it("accepts only an isolated named E2E Postgres environment and synthetic mailbox", () => {
    expect(isDisposableSecurityEmailRuntime(safe)).toBe(true);
    const result = sendDisposableSecurityEmail(message, safe);
    expect(result).toMatchObject({ accepted: true, providerMessageReference: expect.stringMatching(/^disposable-security-email:/) });
    expect(result.providerMessageReference).not.toContain(message.destination);
  });

  it.each([
    { KT_RUNTIME_ENV: "production" }, { KT_NETWORK_DISABLED: "false" },
    { KT_E2E_NETWORK_INTERNAL: "false" }, { KT_E2E_PAYSTACK_ACCEPTANCE: "false" },
    { KT_LOCAL_FULL_FLOW: "true" }, { EMAIL_PROVIDER: "resend" },
    { RESEND_API_KEY: "re_live_secret" }, { PAYSTACK_SECRET_KEY: "sk_live_non_disposable" },
    { DATABASE_URL: "postgresql://kt_phase75_e2e:password@db:5432/production" },
    { DATABASE_URL: "postgresql://railway:password@db:5432/kt_phase75_e2e" },
    { DATABASE_URL: "postgresql://kt_phase75_e2e:password@production.example.com:5432/kt_phase75_e2e" },
    { PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com" },
    { NODE_ENV: "development" },
  ])("refuses a single production safety guard mismatch %j", overrides => {
    expect(isDisposableSecurityEmailRuntime({ ...safe, ...overrides })).toBe(false);
    expect(() => sendDisposableSecurityEmail(message, { ...safe, ...overrides })).toThrow(/not available/);
  });

  it("fails closed on real or malformed email addresses", () => {
    for (const destination of ["real@example.com", "admin@ktcouriers.com", "e2e-test@some-other-domain.test"]) {
      expect(sendDisposableSecurityEmail({ ...message, destination }, safe)).toMatchObject({
        accepted: false, safeCode: "DISPOSABLE_EMAIL_RECIPIENT_DENIED",
      });
    }
  });

  it("rejects absent idempotency or message content, and replays same provider ref", () => {
    expect(sendDisposableSecurityEmail({ ...message, idempotencyKey: "" }, safe).accepted).toBe(false);
    expect(sendDisposableSecurityEmail(message, safe)).toEqual(sendDisposableSecurityEmail(message, safe));
    expect(sendDisposableSecurityEmail({ ...message, idempotencyKey: "another-operation" }, safe).providerMessageReference)
      .not.toBe(sendDisposableSecurityEmail(message, safe).providerMessageReference);
  });

  it("permits isolated QA operational E2E loopback runtime only with strict guards", () => {
    const qaSafe = {
      NODE_ENV: "production",
      KT_RUNTIME_ENV: "e2e",
      KT_DATABASE_CLASSIFICATION: "development",
      KT_NETWORK_DISABLED: "true",
      QA_ACCEPTANCE_LANE_ENABLED: "true",
      PAYSTACK_ACCEPTANCE_SANDBOX_ENABLED: "true",
      KT_E2E_PAYSTACK_BASE_URL: "http://127.0.0.1:4299",
      PAYSTACK_MODE: "test",
      EMAIL_PROVIDER: "console",
      RESEND_API_KEY: "",
      DATABASE_URL: "postgresql://kt_courier:change_me_local_only@127.0.0.1:5433/kt_phase75_e2e?schema=public",
      PAYMENT_APP_ORIGIN: "http://localhost:3200",
    };
    expect(isQaOperationalE2eSecurityEmailRuntime(qaSafe)).toBe(true);
    expect(
      sendDisposableSecurityEmail(
        { ...message, destination: "e2e-qaop-qacust@ktcouriers.local" },
        qaSafe,
      ),
    ).toMatchObject({ accepted: true, providerMessageReference: expect.stringMatching(/^disposable-security-email:/) });

    for (const bad of [
      { KT_RUNTIME_ENV: "production" },
      { KT_DATABASE_CLASSIFICATION: "production" },
      { KT_NETWORK_DISABLED: "false" },
      { KT_E2E_PAYSTACK_BASE_URL: "https://api.paystack.co" },
      { PAYSTACK_SECRET_KEY: "sk_live_forbidden" },
      { EMAIL_PROVIDER: "resend" },
      { DATABASE_URL: "postgresql://user:pass@127.0.0.1:5433/kt_courier" },
      { PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com" },
    ]) {
      expect(isQaOperationalE2eSecurityEmailRuntime({ ...qaSafe, ...bad })).toBe(false);
    }
  });
});
