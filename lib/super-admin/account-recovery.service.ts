import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken, generateResetTokenExpiresAt } from "@/lib/auth/tokens";
import { passwordResetUrl } from "@/lib/auth/password-reset-url";
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";
import { shouldQueueSecurityEmail, securityEmailUnavailableResponse } from "@/lib/auth/security-email-readiness";

export class ManagedResetError extends Error {
  constructor(readonly code: string, message: string, readonly status = 503) { super(message); }
}
/** Never supplies tokens or account-existence information to an administrator. */
export async function requestManagedPasswordReset(actorId: string, submittedEmail: unknown): Promise<{accepted: true}> {
  const email = z.email().trim().toLowerCase().max(254).safeParse(submittedEmail);
  if (!email.success) throw new ManagedResetError("RESET_EMAIL_INVALID", "Enter a valid email address.", 422);
  // The existing security queue must be available. Never mint a token that cannot be delivered.
  if (securityEmailUnavailableResponse() || !shouldQueueSecurityEmail())
    throw new ManagedResetError("RESET_EMAIL_UNAVAILABLE", "Secure password-recovery email is currently unavailable.");
  const user = await prisma.user.findUnique({ where: { email: email.data }, select: { id:true, name:true, role:true, status:true, emailVerifiedAt:true } });
  if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt || user.role === "SUPER_ADMIN" || user.role === "ADMIN")
    return { accepted:true };
  const raw = generateToken(32);
  const expiresAt = generateResetTokenExpiresAt();
  await prisma.$transaction(async tx => {
    const record = await tx.passwordResetToken.create({ data: { userId:user.id, tokenHash:hashToken(raw),expiresAt } });
    await queueSecurityNotification({ eventType:"PASSWORD_RESET", operationId:`password-reset:${record.id}`, subjectUserId:user.id,
      aggregateReference:record.id, expiresAt:record.expiresAt,
      values:{ name:user.name ?? "there", resetUrl:passwordResetUrl(raw),expiresMinutes:60 },
    },tx);
    await tx.adminActivityLog.create({ data:{ actorUserId:actorId, action:"SYSTEM", entityType:"User", entityId:user.id,
      message:"Requested secure self-service password reset delivery.", metadata:{ delivery:"SECURE_EMAIL", tokenExposed:false } } });
  });
  return {accepted:true};
}
