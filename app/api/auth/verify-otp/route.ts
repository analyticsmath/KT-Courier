import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setSessionCookie } from "@/lib/auth/session";
import { verifyAccountEmail } from "@/lib/services/account-email-verification.service";
import { VerifyOtpSchema, formatZodErrors } from "@/lib/validation/auth";
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
      {
        error: "Validation failed.",
        fields: formatZodErrors(parsed.error.issues),
      },
      { status: 422 },
    );
  }

  const { email, code } = parsed.data;

  const rl = await checkAuthRateLimit(
    req,
    "verify-otp",
    email,
    RATE_LIMITS.VERIFY_OTP,
  );
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const result = await verifyAccountEmail(email, code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const cookieStore = await cookies();
  setSessionCookie(cookieStore, result.rawToken);

  const redirect = getPostAuthRedirect(result.role);

  return NextResponse.json({
    message: "Email verified successfully.",
    redirect,
  });
}
