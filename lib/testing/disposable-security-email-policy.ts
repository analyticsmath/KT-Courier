import { createHash } from "node:crypto";
import type { ProviderSendInput, ProviderSendResult } from "@/lib/notifications/providers";

/**
 * Offline security-email acceptance is ONLY for the named disposable E2E
 * PostgreSQL runtime. It never sends mail or handles real recipients.
 * All production environments use the release-locked Resend adapter.
 */
export function isDisposableSecurityEmailRuntime(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  let database: URL, origin: URL;
  try {
    database = new URL(env.DATABASE_URL ?? "invalid:");
    origin = new URL(env.PAYMENT_APP_ORIGIN ?? "invalid:");
  } catch {
    return false;
  }
  return env.KT_RUNTIME_ENV === "e2e"
    && env.KT_NETWORK_DISABLED === "true"
    && env.KT_E2E_NETWORK_INTERNAL === "true"
    && env.KT_E2E_PAYSTACK_ACCEPTANCE === "true"
    && env.KT_LOCAL_FULL_FLOW === "false"
    && env.PAYSTACK_MODE === "test"
    && env.PAYSTACK_SECRET_KEY === "sk_test_disposable_browser_no_provider"
    && env.EMAIL_PROVIDER === "console"
    && !env.RESEND_API_KEY
    && (env.NODE_ENV === "test" || env.NODE_ENV === "production")
    && database.protocol === "postgresql:"
    && database.pathname === "/kt_phase75_e2e"
    && database.username === "kt_phase75_e2e"
    && ["db", "localhost", "127.0.0.1"].includes(database.hostname)
    && origin.protocol === "http:"
    && ["localhost", "127.0.0.1"].includes(origin.hostname);
}

export function sendDisposableSecurityEmail(
  input: ProviderSendInput,
  env: Readonly<Record<string, string | undefined>> = process.env,
): ProviderSendResult {
  if (!isDisposableSecurityEmailRuntime(env)) {
    throw new Error("Disposable security email is not available in this runtime.");
  }
  if (!/^e2e-[a-z0-9-]+@ktcouriers\.local$/.test(input.destination)) {
    return { accepted: false, failureClass: "CONTENT_REJECTED", safeCode: "DISPOSABLE_EMAIL_RECIPIENT_DENIED" };
  }
  if (!input.idempotencyKey || !input.body || !input.subject) {
    return { accepted: false, failureClass: "CONTENT_REJECTED", safeCode: "DISPOSABLE_EMAIL_PAYLOAD_INVALID" };
  }
  return {
    accepted: true,
    providerMessageReference: `disposable-security-email:${createHash("sha256")
      .update(`${input.idempotencyKey}:${input.destination}`)
      .digest("hex")
      .slice(0, 24)}`,
  };
}
