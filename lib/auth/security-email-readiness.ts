import { NextResponse } from "next/server";
import { NOTIFICATION_PRODUCTION_VALIDATION_APPROVED } from "@/lib/notifications/production-readiness";
import { securityPayloadKey } from "@/lib/notifications/security-payload-vault";

/** Development may show a local code without inventing an email delivery. */
export function shouldQueueSecurityEmail(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV === "production") return true;
  if (env.EMAIL_PROVIDER !== "resend" || !env.RESEND_API_KEY?.trim() || !env.EMAIL_FROM?.trim()) return false;
  try { securityPayloadKey(env); return true; } catch { return false; }
}

export function accountEmailQueueFailureResponse() {
  return NextResponse.json(
    { code: "ACCOUNT_EMAIL_UNAVAILABLE", error: "Account emails are temporarily unavailable. Please try again later." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

/** Authentication must not claim to send a code while its delivery authority is unavailable. */
export function securityEmailAvailable(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  if (!NOTIFICATION_PRODUCTION_VALIDATION_APPROVED) return false;
  if (env.EMAIL_PROVIDER !== "resend" || !env.RESEND_API_KEY?.trim() || !env.EMAIL_FROM?.trim()) return false;
  try { securityPayloadKey(env); return true; } catch { return false; }
}

export function securityEmailUnavailableResponse() {
  if (securityEmailAvailable()) return null;
  return accountEmailQueueFailureResponse();
}
