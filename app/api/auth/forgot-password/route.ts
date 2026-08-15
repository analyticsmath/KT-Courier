import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken, generateResetTokenExpiresAt } from "@/lib/auth/tokens";
import { ForgotPasswordSchema, formatZodErrors } from "@/lib/validation/auth";
import { UserStatus } from "@/types/db";
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { tooManyRequests } from "@/lib/api/response";

const GENERIC_RESPONSE = {
  message:
    "If an account with that email exists, a password reset link has been sent.",
};

const RESET_EXPIRES_MINUTES = 60;

function buildResetUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://ktcouriers.co.za"
      : "http://localhost:3000");
  return `${base}/reset-password?token=${token}`;
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = ForgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", fields: formatZodErrors(parsed.error.issues) },
      { status: 422 }
    );
  }

  const { email } = parsed.data;

  const rl = await checkAuthRateLimit(req, "forgot-password", email, RATE_LIMITS.FORGOT_PASSWORD);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.status === UserStatus.DISABLED) {
    // Generic response to avoid user enumeration
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const rawToken = generateToken(32);
  const tokenHash = hashToken(rawToken);

  const resetRecord = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: generateResetTokenExpiresAt(),
    },
  });

  const resetUrl = buildResetUrl(rawToken);

  queueSecurityNotification({ eventType: "PASSWORD_RESET", operationId: `password-reset:${resetRecord.id}`, subjectUserId: user.id, aggregateReference: resetRecord.id, expiresAt: resetRecord.expiresAt, values: { name: user.name ?? "there", resetUrl, expiresMinutes: RESET_EXPIRES_MINUTES } }).catch(() => {});

  return NextResponse.json({
    ...GENERIC_RESPONSE,
    ...(process.env.NODE_ENV !== "production" && {
      _dev_token: rawToken,
      _dev_note: "Reset token visible in development only. Remove in production.",
    }),
  });
}
