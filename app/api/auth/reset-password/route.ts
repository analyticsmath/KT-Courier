import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { ResetPasswordSchema, formatZodErrors } from "@/lib/validation/auth";
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";
import { accountEmailQueueFailureResponse, shouldQueueSecurityEmail, securityEmailUnavailableResponse } from "@/lib/auth/security-email-readiness";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { tooManyRequests } from "@/lib/api/response";
import { recordSecurityEvent, SECURITY_EVENT_TYPES } from "@/lib/services/security-events.service";

const invalidLink = () => NextResponse.json(
  { error: "This reset link is invalid, expired or has already been used." },
  { status: 400, headers: { "Cache-Control": "no-store" } },
);

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;
  const rl = await checkIpRateLimit(req, "reset-password", RATE_LIMITS.RESET_PASSWORD);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(
    { error: "Validation failed.", fields: formatZodErrors(parsed.error.issues) }, { status: 422 },
  );
  const emailUnavailable = securityEmailUnavailableResponse();
  if (emailUnavailable) return emailUnavailable;

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt !== null || record.expiresAt <= new Date()) return invalidLink();
  const newHash = await hashPassword(password);

  let result: { userId: string; revokedSessionCount: number } | null;
  try {
    result = await prisma.$transaction(async (tx) => {
      // Serialize resets for this account, including requests with different valid links.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${record.userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: record.userId }, select: { id: true, name: true, status: true, emailVerifiedAt: true } });
      if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) return null;
      const now = new Date();
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, userId: user.id, tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return null;
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
      const revoked = await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: "PASSWORD_RESET", revokedByUserId: null },
      });
      if (shouldQueueSecurityEmail()) await queueSecurityNotification({
        eventType: "PASSWORD_CHANGED", operationId: `password-changed:${record.id}`,
        subjectUserId: user.id, aggregateReference: user.id, values: { name: user.name ?? "there" },
      }, tx);
      return { userId: user.id, revokedSessionCount: revoked.count };
    });
  } catch {
    return accountEmailQueueFailureResponse();
  }
  if (!result) return invalidLink();

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.SESSION_REVOKED, severity: "HIGH", userId: result.userId,
    message: "Revoked user sessions after password reset", request: req,
    metadata: { reason: "PASSWORD_RESET", revokedSessionCount: result.revokedSessionCount },
  });
  return NextResponse.json(
    { message: "Password updated successfully. Please log in with your new password." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
