import { prisma } from '@/lib/db/prisma';
import { generateOtpCode, hashOtp, otpExpiresAt } from '@/lib/auth/otp';
import { queueSecurityNotification } from '@/lib/notifications/security-delivery';
import { shouldQueueSecurityEmail } from '@/lib/auth/security-email-readiness';
import { OtpPurpose, UserStatus } from '@/types/db';

/** Serializes replacement codes for pending accounts. Inactive or verified accounts are never reissued codes. */
export async function issuePendingVerificationOtp(email: string) {
  const code = generateOtpCode();
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE email = ${email} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { email }, select: { id: true, name: true, status: true } });
    if (!user || user.status !== UserStatus.PENDING_VERIFICATION) return { deliveryId: undefined, eligible: false, devOtp: undefined };
    await tx.otpCode.updateMany({
      where: { email, purpose: OtpPurpose.EMAIL_VERIFICATION, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const otp = await tx.otpCode.create({ data: {
      userId: user.id, email, codeHash: hashOtp(code), purpose: OtpPurpose.EMAIL_VERIFICATION, expiresAt: otpExpiresAt(),
    } });
    if (!shouldQueueSecurityEmail()) return { deliveryId: undefined, eligible: true, devOtp: code };
    const queued = await queueSecurityNotification({
      eventType: 'EMAIL_VERIFICATION_OTP', operationId: `email-verification:${otp.id}`,
      subjectUserId: user.id, aggregateReference: user.id, expiresAt: otp.expiresAt,
      values: { name: user.name ?? 'there', otp: code, expiresMinutes: 15 },
      allowUnverifiedBootstrapEmail: true,
    }, tx);
    return { deliveryId: queued.delivery.id, eligible: true, devOtp: process.env.NODE_ENV !== 'production' ? code : undefined };
  });
}
