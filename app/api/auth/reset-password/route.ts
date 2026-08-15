import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { ResetPasswordSchema, formatZodErrors } from "@/lib/validation/auth";
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { tooManyRequests } from "@/lib/api/response";
import {
  recordSecurityEvent,
  SECURITY_EVENT_TYPES,
} from "@/lib/services/security-events.service";

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const rl = await checkIpRateLimit(req, "reset-password", RATE_LIMITS.RESET_PASSWORD);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", fields: formatZodErrors(parsed.error.issues) },
      { status: 422 }
    );
  }

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt !== null) {
    return NextResponse.json(
      { error: "This reset link is invalid or has already been used." },
      { status: 400 }
    );
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This reset link has expired. Please request a new one." },
      { status: 400 }
    );
  }

  const newHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash: newHash },
      select: { id: true, email: true, name: true },
    });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return updated;
  });

  // Invalidate all existing sessions after password change
  const revokedSessionCount = await revokeAllUserSessions({
    userId: record.userId,
    reason: "PASSWORD_RESET",
  });

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.SESSION_REVOKED,
    severity: "HIGH",
    userId: record.userId,
    message: "Revoked user sessions after password reset",
    request: req,
    metadata: {
      reason: "PASSWORD_RESET",
      revokedSessionCount,
    },
  });

  queueSecurityNotification({ eventType: "PASSWORD_CHANGED", operationId: `password-changed:${record.id}`, subjectUserId: user.id, aggregateReference: user.id, values: { name: user.name ?? "there" } }).catch(() => {});

  return NextResponse.json({
    message: "Password updated successfully. Please log in with your new password.",
  });
}
