import { prisma } from "@/lib/db/prisma";
import { otpHashCandidates } from "@/lib/auth/otp";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { sessionExpiresAt } from "@/lib/auth/session";
import { OtpPurpose, UserStatus } from "@/types/db";
import { INVALID_VERIFICATION_NOTICE } from "@/lib/auth/public-auth-messages";

/** Consuming the code, activating an eligible account and issuing its session share the account lock. */
export async function verifyAccountEmail(email: string, code: string) {
  return prisma.$transaction(async tx => {
    const identity = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (!identity) return { ok: false as const, status: 400, error: INVALID_VERIFICATION_NOTICE };
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${identity.id} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: identity.id } });
    if (user.status !== UserStatus.PENDING_VERIFICATION && user.status !== UserStatus.ACTIVE) {
      return { ok: false as const, status: 400, error: INVALID_VERIFICATION_NOTICE };
    }
    const otp = await tx.otpCode.findFirst({
      where: { email, codeHash: { in: otpHashCandidates(code) }, purpose: OtpPurpose.EMAIL_VERIFICATION, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) return { ok: false as const, status: 400, error: INVALID_VERIFICATION_NOTICE };
    const now = new Date();
    if (otp.expiresAt <= now) return { ok: false as const, status: 400, error: INVALID_VERIFICATION_NOTICE };
    const consumed = await tx.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now },
    });
    if (consumed.count !== 1) return { ok: false as const, status: 400, error: INVALID_VERIFICATION_NOTICE };
    await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? now, status: UserStatus.ACTIVE } });
    // The first successful account verification is the authoritative welcome
    // event. Keep its durable intent in the same transaction as activation.
    // Resent/replayed verification codes never create duplicate welcomes.
    if (!user.emailVerifiedAt) {
      await tx.notificationEventIntent.upsert({
        where: { operationId: `account-welcome:${user.id}` },
        update: {},
        create: {
          sourceAuthority: "ACCOUNT",
          eventType: "ACCOUNT_EMAIL_VERIFIED",
          aggregateReference: user.id,
          operationId: `account-welcome:${user.id}`,
          safePayload: {},
        },
      });
    }
    const rawToken = generateToken(32);
    await tx.session.create({ data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: sessionExpiresAt() } });
    return { ok: true as const, rawToken, role: user.role };
  });
}
