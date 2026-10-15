import { prisma } from "@/lib/db/prisma";
import { generateOtpCode, hashOtp } from "@/lib/auth/otp";
import { DELIVERY_OTP_EXPIRY_MINUTES, DELIVERY_OTP_MAX_ATTEMPTS } from "@/lib/constants/delivery";
import { Prisma } from "@prisma/client";
import { isOtpLocked } from "@/lib/driver-operations/otp-policy";
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";
import { resolveDeliveryOtpRecipient } from "./delivery-recipient.service";
import { assertAcceptedCurrentDriver } from "@/lib/driver-operations/authority";
import { DriverOperationError } from "@/lib/driver-operations/errors";
import { completeOperationReceiptInTx, createOperationReceiptInTx, driverOperationRequestHash, type DriverOperationSnapshot } from "@/lib/driver-operations/idempotency";
import { NotificationPolicyError } from "@/lib/notifications/contracts";
import type { RequestDeliveryOtpInput } from "@/lib/validation/delivery";

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

// Issuance, encrypted notification intent and driver receipt commit together.
// Retrying an operation returns only safe original receipt metadata.
export type GenerateDeliveryOtpResult =
  | { ok: true; otpId: string; expiresAt: Date; sentToEmailMasked: string; replay: boolean }
  | { ok: false; error: string };

function maskEmail(email: string | null): string {
  if (!email) return "recipient address";
  const [local, domain] = email.split("@", 2);
  return local && domain ? `${local.slice(0, 1)}***@${domain}` : "recipient address";
}

export async function generateAndSendDeliveryOtp(
  assignmentId: string,
  driverProfileId: string,
  driverUserId: string,
  input: RequestDeliveryOtpInput,
): Promise<GenerateDeliveryOtpResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        // The operation lock serializes parallel retries; the row locks also
        // serialize different resend operations and assignment revocation.
        await tx.$queryRaw`SELECT (pg_advisory_xact_lock(hashtextextended(${`delivery-otp-operation:${input.operationId}`}, 0)) IS NULL) AS locked`;
        await tx.$queryRaw`SELECT a."id" FROM "OrderAssignment" a JOIN "Order" o ON o."id" = a."orderId" WHERE a."id" = ${assignmentId} FOR UPDATE OF a, o`;
        const existing = await tx.driverOperationCommand.findUnique({ where: { operationId: input.operationId } });
        if (existing) {
          if (existing.requestHash !== driverOperationRequestHash(input)) throw new DriverOperationError("This operation ID was already used with different request data.", "DRIVER_OPERATION_IDEMPOTENCY_CONFLICT");
          const receipt = existing.resultSnapshot as DriverOperationSnapshot | null;
          if (!existing.completedAt || !receipt) throw new DriverOperationError("This operation is still being processed. Retry shortly.", "DRIVER_OPERATION_STALE");
          if (receipt.type !== "DELIVERY_OTP_REQUEST" || receipt.assignmentId !== assignmentId || receipt.driverProfileId !== driverProfileId) throw new DriverOperationError("Operation receipt belongs to another assignment.", "DRIVER_OPERATION_FORBIDDEN");
          const owned = await tx.orderAssignment.findFirst({ where: { id: assignmentId, orderId: receipt.orderId, driverProfileId, driverProfile: { userId: driverUserId, status: "ACTIVE", user: { status: "ACTIVE", role: "DRIVER" } } }, select: { id: true } });
          if (!owned) throw new DriverOperationError("Assignment replay is unavailable for this driver.", "DRIVER_OPERATION_FORBIDDEN");
          return { result: { ok: true as const, otpId: receipt.createdOtpId ?? "", expiresAt: new Date(receipt.otpExpiresAt ?? receipt.completedAt), sentToEmailMasked: receipt.otpSentToEmailMasked ?? "recipient address", replay: true } };
        }
        const authority = await assertAcceptedCurrentDriver(assignmentId, driverProfileId, input.assignmentVersion, tx);
        if (authority.driverUserId !== driverUserId || !["IN_TRANSIT", "DELIVERY_ATTEMPTED"].includes(authority.orderStatus)) throw new DriverOperationError("Only the active assigned driver can issue a delivery OTP while delivery is in transit.", "DRIVER_OPERATION_FORBIDDEN");
        const order = await tx.order.findUniqueOrThrow({ where: { id: authority.orderId }, select: { id: true, orderNumber: true } });
        const recipient = await resolveDeliveryOtpRecipient(order.id, tx);
        const now = new Date();
        const active = await tx.deliveryOtp.findFirst({ where: { orderId: order.id, consumedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" } });
        if (active?.lastSentAt && now.getTime() - active.lastSentAt.getTime() < DELIVERY_OTP_REISSUE_COOLDOWN_SECONDS * 1000) throw new DriverOperationError("Please wait before requesting another delivery OTP.", "DRIVER_OPERATION_INVALID_STATE");
        if (await tx.deliveryOtp.count({ where: { orderId: order.id, createdAt: { gte: new Date(now.getTime() - 60 * 60_000) } } }) >= DELIVERY_OTP_MAX_ISSUES_PER_HOUR) throw new DriverOperationError("Too many OTP requests. Please try again later.", "DRIVER_OPERATION_INVALID_STATE");
        await createOperationReceiptInTx(tx, { operationId: input.operationId, payload: input, orderId: order.id, assignmentId, driverProfileId, type: "DELIVERY_OTP_REQUEST" });
        await tx.deliveryOtp.updateMany({ where: { orderId: order.id, consumedAt: null }, data: { consumedAt: now, invalidatedAt: now } });
        const plainCode = generateOtpCode();
        const expiresAt = deliveryOtpExpiresAt();
        const otp = await tx.deliveryOtp.create({ data: { orderId: order.id, assignmentId, codeHash: hashOtp(plainCode), expiresAt, maxAttempts: DELIVERY_OTP_MAX_ATTEMPTS, lastSentAt: now, sentToEmail: recipient.email, createdByUserId: driverUserId, resendCount: 1 } });
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        await queueSecurityNotification({ eventType: "DELIVERY_OTP", operationId: input.operationId, subjectUserId: recipient.subjectUserId, aggregateReference: order.id, expiresAt, values: { name: recipient.name, otp: plainCode, expiresMinutes: DELIVERY_OTP_EXPIRY_MINUTES, orderNumber: order.orderNumber, orderUrl: `${appUrl}/track` } }, tx);
        const sentToEmailMasked = maskEmail(recipient.email);
        await completeOperationReceiptInTx(tx, input.operationId, { type: "DELIVERY_OTP_REQUEST", orderId: order.id, assignmentId, driverProfileId, orderStatus: authority.orderStatus, assignmentStatus: authority.assignmentStatus, createdOtpId: otp.id, otpExpiresAt: expiresAt.toISOString(), otpSentToEmailMasked: sentToEmailMasked, completedAt: now.toISOString() });
        return { result: { ok: true as const, otpId: otp.id, expiresAt, sentToEmailMasked, replay: false }, testCode: process.env.NODE_ENV === "test" ? plainCode : undefined };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
      if (outcome.testCode) testOtpCodes.set(outcome.result.otpId, outcome.testCode);
      return outcome.result;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      const sqlState = error && typeof error === "object" && "meta" in error && error.meta && typeof error.meta === "object" && "code" in error.meta ? String(error.meta.code) : "";
      if ((["P2034", "P2002", "40001"].includes(code) || sqlState === "40001") && attempt < 2) continue;
      if (error instanceof DriverOperationError) return { ok: false, error: error.message };
      if (error instanceof NotificationPolicyError) return { ok: false, error: "OTP delivery could not be queued to the shipment recipient. Check the recipient details and retry." };
      throw error;
    }
  }
  return { ok: false, error: "OTP issuance could not be completed. Retry shortly." };
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
  plainCode: string,
  assignmentId?: string,
): Promise<VerifyOtpResult> {
  const now = new Date();
  const otp = await tx.deliveryOtp.findFirst({
    where: { orderId, ...(assignmentId ? { assignmentId } : {}), consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    const expired = await tx.deliveryOtp.findFirst({ where: { orderId, ...(assignmentId ? { assignmentId } : {}), consumedAt: null }, orderBy: { createdAt: "desc" } });
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
    sentToEmail: maskEmail(otp.sentToEmail),
    expiresAt: otp.expiresAt,
    attemptsUsed: otp.attempts,
    maxAttempts: otp.maxAttempts,
    canResend: otp.attempts < otp.maxAttempts,
  };
}
