import { NextResponse } from "next/server";
import { NOTIFICATION_PRODUCTION_VALIDATION_APPROVED } from "@/lib/notifications/production-readiness";

/** Authentication must not claim to send a code while its delivery authority is unavailable. */
export function securityEmailAvailable(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV !== "production") return true;
  if (!NOTIFICATION_PRODUCTION_VALIDATION_APPROVED) return false;
  if (
    env.EMAIL_PROVIDER !== "resend" ||
    !env.RESEND_API_KEY?.trim() ||
    !env.EMAIL_FROM?.trim()
  )
    return false;
  return (
    Buffer.from(
      env.NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY ?? "",
      "base64",
    ).length === 32
  );
}

export function securityEmailUnavailableResponse() {
  if (securityEmailAvailable()) return null;
  return NextResponse.json(
    {
      code: "ACCOUNT_EMAIL_UNAVAILABLE",
      error:
        "Account emails are temporarily unavailable. Please try again later.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
