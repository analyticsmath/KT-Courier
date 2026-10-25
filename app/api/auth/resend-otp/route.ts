import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ResendOtpSchema, formatZodErrors } from "@/lib/validation/auth";
import { UserStatus } from "@/types/db";
import { VERIFICATION_NOTICE } from "@/lib/auth/public-auth-messages";
import { deliverSecurityEmail } from "@/lib/notifications/security-email-delivery";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { tooManyRequests } from "@/lib/api/response";
import {
  accountEmailQueueFailureResponse,
  securityEmailUnavailableResponse,
} from "@/lib/auth/security-email-readiness";
import { issuePendingVerificationOtp } from "@/lib/auth/pending-verification-otp";

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = ResendOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        fields: formatZodErrors(parsed.error.issues),
      },
      { status: 422 },
    );
  }

  const { email } = parsed.data;

  const rl = await checkAuthRateLimit(
    req,
    "resend-otp",
    email,
    RATE_LIMITS.RESEND_OTP,
  );
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const emailUnavailable = securityEmailUnavailableResponse();
  if (emailUnavailable) return emailUnavailable;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to avoid user enumeration.
  if (!user || user.status !== UserStatus.PENDING_VERIFICATION) {
    return NextResponse.json({
      message: VERIFICATION_NOTICE,
      ...(process.env.NODE_ENV === "production" && { deliveryPending: true }),
    }, { status: process.env.NODE_ENV === "production" ? 202 : 200, headers: { "Cache-Control": "no-store" } });
  }

  const queued = await issuePendingVerificationOtp(email).catch(() => null);

  if (!queued) return accountEmailQueueFailureResponse();

  if (process.env.NODE_ENV === "production" && queued.deliveryId) {
    // The durable outbox owns retries. Inline provider failure must not turn a
    // committed request into an account-existence signal or claim delivery.
    await deliverSecurityEmail(queued.deliveryId).catch(
      () => null,
    );
  }

  return NextResponse.json({
    message: VERIFICATION_NOTICE,
    ...(process.env.NODE_ENV === "production" && { deliveryPending: true }),
    ...(process.env.NODE_ENV !== "production" && {
      _dev_otp: queued.devOtp,
      _dev_note: "OTP visible in development only.",
    }),
  }, { status: process.env.NODE_ENV === "production" ? 202 : 200, headers: { "Cache-Control": "no-store" } });
}
