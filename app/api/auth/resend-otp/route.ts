import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateOtpCode, hashOtp, otpExpiresAt } from "@/lib/auth/otp";
import { ResendOtpSchema, formatZodErrors } from "@/lib/validation/auth";
import { OtpPurpose, UserStatus } from "@/types/db";
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { tooManyRequests } from "@/lib/api/response";

const OTP_EXPIRES_MINUTES = 15;

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = ResendOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", fields: formatZodErrors(parsed.error.issues) },
      { status: 422 }
    );
  }

  const { email } = parsed.data;

  const rl = checkAuthRateLimit(req, "resend-otp", email, RATE_LIMITS.RESEND_OTP);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to avoid user enumeration
  if (!user || user.status !== UserStatus.PENDING_VERIFICATION) {
    return NextResponse.json({
      message: "If your account exists and is unverified, a new code has been sent.",
    });
  }

  // Consume all active verification OTPs for this email
  await prisma.otpCode.updateMany({
    where: {
      email,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });

  const code = generateOtpCode();
  const otp = await prisma.otpCode.create({
    data: {
      userId: user.id,
      email,
      codeHash: hashOtp(code),
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      expiresAt: otpExpiresAt(),
    },
  });

  queueSecurityNotification({ eventType: "EMAIL_VERIFICATION_OTP", operationId: `email-verification:${otp.id}`, subjectUserId: user.id, aggregateReference: user.id, expiresAt: otp.expiresAt, values: { name: user.name ?? "there", otp: code, expiresMinutes: OTP_EXPIRES_MINUTES }, allowUnverifiedBootstrapEmail: true }).catch(() => {});

  return NextResponse.json({
    message: "A new verification code has been sent to your email.",
    ...(process.env.NODE_ENV !== "production" && {
      _dev_otp: code,
      _dev_note: "OTP visible in development only. Remove in production.",
    }),
  });
}
