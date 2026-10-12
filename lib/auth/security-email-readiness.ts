import { NextResponse } from "next/server";
import { otpHmacKeyAvailable } from "@/lib/auth/otp";
import { NOTIFICATION_PRODUCTION_VALIDATION_APPROVED } from "@/lib/notifications/production-readiness";
import { securityPayloadKey } from "@/lib/notifications/security-payload-vault";
import { assertDisposablePaystackAcceptance } from "@/lib/testing/disposable-paystack-policy";

function providerConfigured(
  env: Record<string, string | undefined>,
): boolean {
  return Boolean(
    env.EMAIL_PROVIDER === "resend" &&
      env.RESEND_API_KEY?.trim() &&
      env.EMAIL_FROM?.trim(),
  );
}

/** Development may show a local code without inventing an email delivery. */
export function shouldQueueSecurityEmail(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV === "production") return true;
  // The named offline browser runtime exercises durable encrypted intents;
  // its CLI reads the synthetic inbox without claiming provider delivery.
  try { assertDisposablePaystackAcceptance(env); securityPayloadKey(env); return true; } catch { /* Normal provider readiness follows. */ }
  if (!providerConfigured(env)) return false;
  try {
    securityPayloadKey(env);
    return true;
  } catch {
    return false;
  }
}

export function accountEmailQueueFailureResponse() {
  return NextResponse.json(
    {
      code: "ACCOUNT_EMAIL_UNAVAILABLE",
      error:
        "Account emails are temporarily unavailable. Please try again later.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Authentication must not claim to send a code while its provider, encryption
 * authority or keyed OTP hashing authority is unavailable.
 */
export function securityEmailAvailable(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV !== "production") return true;
  if (!NOTIFICATION_PRODUCTION_VALIDATION_APPROVED) return false;
  if (!providerConfigured(env) || !otpHmacKeyAvailable(env)) return false;
  try {
    securityPayloadKey(env);
    return true;
  } catch {
    return false;
  }
}

export function securityEmailUnavailableResponse() {
  if (securityEmailAvailable()) return null;
  return accountEmailQueueFailureResponse();
}
