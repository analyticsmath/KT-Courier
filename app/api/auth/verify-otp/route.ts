import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { hashOtp } from "@/lib/auth/otp";
import { createSession, SESSION_COOKIE_NAME, sessionExpiresAt } from "@/lib/auth/session";
import { VerifyOtpSchema, formatZodErrors } from "@/lib/validation/auth";
import { OtpPurpose, UserStatus } from "@/types/db";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { tooManyRequests } from "@/lib/api/response";
import { getPostAuthRedirect } from "@/lib/auth/role-redirects";

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = VerifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", fields: formatZodErrors(parsed.error.issues) },
      { status: 422 }
    );
  }

  const { email, code } = parsed.data;

  const rl = checkAuthRateLimit(req, "verify-otp", email, RATE_LIMITS.VERIFY_OTP);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const codeHash = hashOtp(code);

  const otp = await prisma.otpCode.findFirst({
    where: {
      email,
      codeHash,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return NextResponse.json(
      { error: "Invalid or already used verification code." },
      { status: 400 }
    );
  }

  if (otp.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Verification code has expired. Please request a new one." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  // Mark OTP consumed and activate user
  await prisma.$transaction([
    prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
      },
    }),
  ]);

  // Create a session so the user is logged in immediately after verification
  const rawToken = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: sessionExpiresAt(),
  });

  const redirect = getPostAuthRedirect(user.role);

  return NextResponse.json({
    message: "Email verified successfully.",
    redirect,
  });
}
