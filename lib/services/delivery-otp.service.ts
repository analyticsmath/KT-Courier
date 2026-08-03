import { prisma } from "@/lib/db/prisma";
import { generateOtpCode, hashOtp } from "@/lib/auth/otp";
import { DELIVERY_OTP_EXPIRY_MINUTES, DELIVERY_OTP_MAX_ATTEMPTS } from "@/lib/constants/delivery";
import type { Prisma } from "@/types/db";
import { isOtpLocked } from "@/lib/driver-operations/otp-policy";
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";

const DELIVERY_OTP_REISSUE_COOLDOWN_SECONDS = 60;
const DELIVERY_OTP_MAX_ISSUES_PER_HOUR = 5;
const testOtpCodes = new Map<string, string>();

// ─── Delivery OTP expiry configuration ────────────────────────────────────────
// 30-minute expiry. Documented in docs/delivery-otp.md.

function deliveryOtpExpiresAt(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + DELIVERY_OTP_EXPIRY_MINUTES);
  return d;
}

// ─── Generate a new delivery OTP ──────────────────────────────────────────────
// - Invalidates any existing active OTP for this order (by marking all previous
//   as consumed) so only one OTP is valid at a time.
// - Stores hash only — plain code is returned to caller once for sending and
//   MUST NOT be stored or logged anywhere.

export type GenerateDeliveryOtpResult =
  | { ok: true; otpId: string; plainCode: string; expiresAt: Date; sentToEmail: string }
  | { ok: false; error: string };

export async function generateAndSendDeliveryOtp(
  orderId: string,
  assignmentId: string | null,
  driverUserId: string,
  recipientEmail: string,
  recipientName: string,
  orderNumber: string,
  source: string,
  operationId?: string
): Promise<GenerateDeliveryOtpResult> {
  const now = new Date();
  const active = await prisma.deliveryOtp.findFirst({ where: { orderId, consumedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" } });
  if (active?.lastSentAt && now.getTime() - active.lastSentAt.getTime() < DELIVERY_OTP_REISSUE_COOLDOWN_SECONDS * 1000) {
    return { ok: false, error: "Please wait before requesting another delivery OTP." };
  }
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  if (await prisma.deliveryOtp.count({ where: { orderId, createdAt: { gte: hourAgo } } }) >= DELIVERY_OTP_MAX_ISSUES_PER_HOUR) {
    return { ok: false, error: "Too many OTP requests. Please try again later." };
  }
  // Invalidate all unconsumed OTPs for this order
  await prisma.deliveryOtp.updateMany({
    where: {
      orderId,
      consumedAt: null,
    },
    data: { consumedAt: new Date(), invalidatedAt: new Date() },
  });

  // Generate a fresh OTP
  const plainCode = generateOtpCode();
  const codeHash = hashOtp(plainCode);
  const expiresAt = deliveryOtpExpiresAt();

  const otp = await prisma.deliveryOtp.create({
    data: {
      orderId,
      assignmentId,
      codeHash,
      expiresAt,
      maxAttempts: DELIVERY_OTP_MAX_ATTEMPTS,
      lastSentAt: new Date(),
      sentToEmail: recipientEmail,
      createdByUserId: driverUserId,
    },
  });
  if (process.env.NODE_ENV === "test") testOtpCodes.set(otp.id, plainCode);

  // Authentication/delivery owns code generation; Phase 27 owns the encrypted
  // security-delivery intent. The plain code is never written to a notification
  // receipt, message, audit event, provider attempt, or log.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const orderUrl = `${appUrl}/${source === "STORE" ? "store" : "account"}/orders/${orderId}`;
  const recipient = await prisma.user.findUnique({ where: { email: recipientEmail }, select: { id: true } });
  try {
    await queueSecurityNotification({
      eventType: "DELIVERY_OTP",
      operationId: operationId ?? `delivery-otp:${otp.id}`,
      subjectUserId: recipient?.id,
      aggregateReference: orderId,
      expiresAt,
      values: { name: recipientName, otp: plainCode, expiresMinutes: DELIVERY_OTP_EXPIRY_MINUTES, orderNumber, orderUrl },
    });
  } catch {
    // OTP was created but email failed — we report the failure.
    // The driver must retry. Invalidate the OTP so there's no dangling code.
    await prisma.deliveryOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date(), invalidatedAt: new Date() },
    });
    testOtpCodes.delete(otp.id);
    return {
      ok: false,
      error: "OTP delivery could not be queued to a verified notification destination. Please check the recipient account and retry.",
    };
  }

  // Update resendCount on existing record to track how many times OTP has been sent
  await prisma.deliveryOtp.update({
    where: { id: otp.id },
    data: { resendCount: { increment: 1 } },
  });

  return {
    ok: true,
    otpId: otp.id,
    plainCode,
    expiresAt,
    sentToEmail: recipientEmail,
  };
}

// ─── Resend delivery OTP ──────────────────────────────────────────────────────
// Generates a fresh OTP (invalidates old one) and resends.

export async function resendDeliveryOtp(
  orderId: string,
  assignmentId: string | null,
  driverUserId: string,
  recipientEmail: string,
  recipientName: string,
  orderNumber: string,
  source: string,
  operationId?: string
): Promise<GenerateDeliveryOtpResult> {
  // Reuse generate — it always invalidates previous OTPs
  return generateAndSendDeliveryOtp(
    orderId,
    assignmentId,
    driverUserId,
    recipientEmail,
    recipientName,
    orderNumber,
    source,
    operationId
  );
}

// ─── Verify delivery OTP ──────────────────────────────────────────────────────
// Increments attempts. Returns ok:true only if code is correct, unexpired,
// unconsumed, and under attempt limit. Never returns the hash.

export interface VerifyOtpResult {
  ok: boolean;
  error?: string;
  otpId?: string;
}

export async function verifyDeliveryOtp(
  orderId: string,
  plainCode: string
): Promise<VerifyOtpResult> {
  return prisma.$transaction((tx) => verifyDeliveryOtpInTx(tx, orderId, plainCode));
}

/** Transactional verification used by delivery completion. It consumes the OTP
 * only if POD, status transition, assignment completion, and audit all commit. */
export async function verifyDeliveryOtpInTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  plainCode: string
): Promise<VerifyOtpResult> {
  const now = new Date();
  const otp = await tx.deliveryOtp.findFirst({
    where: { orderId, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    const expired = await tx.deliveryOtp.findFirst({ where: { orderId, consumedAt: null }, orderBy: { createdAt: "desc" } });
    return { ok: false, error: expired ? "Delivery OTP has expired. Please request a new code." : "No active delivery OTP found. Please request a new code." };
  }
  if (otp.lockedAt || isOtpLocked(otp.attempts, otp.maxAttempts)) {
    return { ok: false, error: "Too many incorrect attempts. Please request a new delivery OTP." };
  }

  if (hashOtp(plainCode) !== otp.codeHash) {
    const incremented = await tx.deliveryOtp.updateMany({
      where: { id: otp.id, consumedAt: null, lockedAt: null, attempts: { lt: otp.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (!incremented.count) return { ok: false, error: "Too many incorrect attempts. Please request a new delivery OTP." };
    const current = await tx.deliveryOtp.findUniqueOrThrow({ where: { id: otp.id }, select: { attempts: true, maxAttempts: true } });
    if (current.attempts >= current.maxAttempts) {
      await tx.deliveryOtp.updateMany({ where: { id: otp.id, lockedAt: null }, data: { lockedAt: now } });
      return { ok: false, error: "Too many incorrect attempts. Please request a new delivery OTP." };
    }
    return { ok: false, error: "Incorrect code." };
  }

  const consumed = await tx.deliveryOtp.updateMany({
    where: { id: otp.id, consumedAt: null, lockedAt: null, attempts: { lt: otp.maxAttempts }, expiresAt: { gt: now } },
    data: { attempts: { increment: 1 }, consumedAt: now, verifiedAt: now },
  });
  if (!consumed.count) return { ok: false, error: "Delivery OTP is no longer valid. Please request a new code." };
  return { ok: true, otpId: otp.id };
}

/** Test fixture boundary only. It never exists in production routes or builds. */
export function getTestIssuedDeliveryOtp(otpId: string): string {
  if (process.env.NODE_ENV !== "test") throw new Error("Test OTP access is unavailable outside tests.");
  const code = testOtpCodes.get(otpId);
  if (!code) throw new Error("Test OTP was not issued in this process.");
  return code;
}

// ─── Get OTP send status (safe — no hash, no code) ────────────────────────────

export interface OtpStatusDto {
  hasActiveOtp: boolean;
  sentToEmail: string | null;
  expiresAt: Date | null;
  attemptsUsed: number;
  maxAttempts: number;
  canResend: boolean;
}

export async function getDeliveryOtpStatus(orderId: string): Promise<OtpStatusDto> {
  const now = new Date();
  const otp = await prisma.deliveryOtp.findFirst({
    where: {
      orderId,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return {
      hasActiveOtp: false,
      sentToEmail: null,
      expiresAt: null,
      attemptsUsed: 0,
      maxAttempts: DELIVERY_OTP_MAX_ATTEMPTS,
      canResend: true,
    };
  }

  return {
    hasActiveOtp: true,
    sentToEmail: otp.sentToEmail,
    expiresAt: otp.expiresAt,
    attemptsUsed: otp.attempts,
    maxAttempts: otp.maxAttempts,
    canResend: otp.attempts < otp.maxAttempts,
  };
}
