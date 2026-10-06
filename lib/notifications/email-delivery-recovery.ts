import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { nextRetryAt } from "./contracts";
import type { ProviderSendResult } from "./providers";
import { assertNotificationProductionReady } from "./production-readiness";

export const EMAIL_SENDING_STALE_MS = 15 * 60_000;
// Resend retains keys for 24 hours. Leave an hour for scheduling/network delay.
export const EMAIL_SAFE_REPLAY_MS = 23 * 60 * 60_000;
type Database = Pick<PrismaClient, "$transaction" | "notificationDelivery">;
type Transaction = Prisma.TransactionClient;
class SupersededEmailAttempt extends Error {}

export function emailWorkWhere(at = new Date()): Prisma.NotificationDeliveryWhereInput {
  return { channel: "EMAIL", OR: [
    { status: { in: ["QUEUED", "FAILED_RETRYABLE"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: at } }] },
    { status: "SENDING", updatedAt: { lte: new Date(at.getTime() - EMAIL_SENDING_STALE_MS) } },
  ] };
}

async function requireReconciliation(tx: Transaction, deliveryId: string, code: string) {
  const publicReference = `nrecovery_${createHash("sha256").update(deliveryId).digest("hex").slice(0, 24)}`;
  await tx.notificationReconciliationCase.upsert({
    where: { publicReference }, update: { lastObservedAt: new Date() },
    create: { publicReference, deliveryId, reason: "DELIVERY_STALLED", safeSummary: "Interrupted email requires provider reconciliation before any further send.", safeEvidence: { code } },
  });
}

/** Atomic delivery claim and durable attempt: no provider call before commit. */
export async function claimEmailAttempt(db: Database, input: { deliveryId: string; provider: string; operationId: string }) {
  return db.$transaction(async (tx) => {
    const delivery = await tx.notificationDelivery.findUnique({ where: { id: input.deliveryId } });
    if (!delivery || !["QUEUED", "FAILED_RETRYABLE"].includes(delivery.status)) return null;
    const at = new Date();
    if (delivery.nextAttemptAt && delivery.nextAttemptAt > at) return null;
    const claimed = await tx.notificationDelivery.updateMany({ where: { id: delivery.id, status: delivery.status, updatedAt: delivery.updatedAt }, data: { status: "SENDING", provider: input.provider, updatedAt: at } });
    if (!claimed.count) return null;
    const first = await tx.notificationDeliveryAttempt.findFirst({ where: { deliveryId: delivery.id }, orderBy: { attemptNumber: "asc" } });
    const attempts = await tx.notificationDeliveryAttempt.count({ where: { deliveryId: delivery.id } });
    const expired = delivery.expiresAt && delivery.expiresAt <= at;
    const unsafe = first && input.provider === "RESEND_EMAIL" && first.startedAt.getTime() + EMAIL_SAFE_REPLAY_MS <= at.getTime();
    if (expired || unsafe || attempts >= 5) {
      const code = unsafe ? "PROVIDER_IDEMPOTENCY_WINDOW_EXCEEDED" : "DELIVERY_RETRY_EXHAUSTED";
      await tx.notificationDelivery.update({ where: { id: delivery.id }, data: { status: expired ? "EXPIRED" : "FAILED_PERMANENT", nextAttemptAt: null, eligibilityReason: expired ? null : code } });
      if (!expired) await requireReconciliation(tx, delivery.id, code);
      return null;
    }
    const attemptNumber = attempts + 1;
    const attempt = await tx.notificationDeliveryAttempt.create({ data: {
      publicReference: `nattempt_${createHash("sha256").update(`${delivery.id}:${attemptNumber}`).digest("hex").slice(0, 24)}`,
      deliveryId: delivery.id, attemptNumber, operationId: `${input.operationId}:${attemptNumber}`, provider: input.provider, status: "STARTED", startedAt: at,
    } });
    return { delivery, attempt, claimAt: at };
  });
}

/** CAS fencing prevents a recovered/late sender from rewriting newer state. */
export async function finishEmailAttempt(db: Database, claim: NonNullable<Awaited<ReturnType<typeof claimEmailAttempt>>>, result: ProviderSendResult) {
  try { return await db.$transaction(async (tx) => {
    const failure = result.failureClass ?? "UNKNOWN_PROVIDER_FAILURE";
    const retryAt = result.accepted ? null : nextRetryAt({ failure, attemptNumber: claim.attempt.attemptNumber, retryAfterSeconds: result.retryAfterSeconds, expiresAt: claim.delivery.expiresAt });
    const changed = await tx.notificationDelivery.updateMany({
      where: { id: claim.delivery.id, status: "SENDING", updatedAt: claim.claimAt },
      data: { status: result.accepted ? "PROVIDER_ACCEPTED" : retryAt ? "FAILED_RETRYABLE" : "FAILED_PERMANENT", provider: claim.attempt.provider, providerMessageReference: result.providerMessageReference ?? null, nextAttemptAt: retryAt },
    });
    if (changed.count) {
      const attemptChanged = await tx.notificationDeliveryAttempt.updateMany({ where: { id: claim.attempt.id, status: "STARTED" }, data: {
      status: result.accepted ? "PROVIDER_ACCEPTED" : "FAILED", completedAt: new Date(), providerMessageReference: result.providerMessageReference ?? null,
      failureClass: result.accepted ? null : failure, safeProviderCode: result.safeCode ?? null, nextAttemptAt: retryAt,
      } });
      // Also fence by immutable attempt identity if clocks roll back or two
      // claims receive the same millisecond timestamp. Roll back both writes.
      if (!attemptChanged.count) throw new SupersededEmailAttempt();
    }
    return { delivery: await tx.notificationDelivery.findUniqueOrThrow({ where: { id: claim.delivery.id } }), applied: Boolean(changed.count) };
  }); } catch (error) {
    if (!(error instanceof SupersededEmailAttempt)) throw error;
    return { delivery: await db.notificationDelivery.findUniqueOrThrow({ where: { id: claim.delivery.id } }), applied: false };
  }
}

/** Recover only stale EMAIL claims; never replay unknown/too-old provider work. */
export async function recoverStalledEmailDeliveries(db: Database, limit: number) {
  assertNotificationProductionReady();
  const at = new Date();
  const cutoff = new Date(at.getTime() - EMAIL_SENDING_STALE_MS);
  const candidates = await db.notificationDelivery.findMany({ where: { channel: "EMAIL", status: "SENDING", updatedAt: { lte: cutoff } }, orderBy: { updatedAt: "asc" }, take: Math.max(1, Math.min(limit, 200)) });
  let recovered = 0; let reconciled = 0;
  for (const candidate of candidates) {
    const outcome = await db.$transaction(async (tx) => {
      const claimed = await tx.notificationDelivery.updateMany({ where: { id: candidate.id, channel: "EMAIL", status: "SENDING", updatedAt: candidate.updatedAt }, data: { updatedAt: at } });
      if (!claimed.count) return "PEER";
      const attempts = await tx.notificationDeliveryAttempt.findMany({ where: { deliveryId: candidate.id }, orderBy: { attemptNumber: "asc" } });
      const accepted = attempts.find((attempt) => attempt.status === "PROVIDER_ACCEPTED" && attempt.providerMessageReference);
      if (accepted) {
        await tx.notificationDelivery.update({ where: { id: candidate.id }, data: { status: "PROVIDER_ACCEPTED", provider: accepted.provider, providerMessageReference: accepted.providerMessageReference, nextAttemptAt: null } });
        return "RECOVERED";
      }
      const first = attempts[0];
      const expired = candidate.expiresAt && candidate.expiresAt <= at;
      const safe = first && first.provider === "RESEND_EMAIL" && first.startedAt.getTime() + EMAIL_SAFE_REPLAY_MS > at.getTime() && attempts.length < 5;
      const code = !first ? "MISSING_DELIVERY_ATTEMPT" : first.provider !== "RESEND_EMAIL" ? "PROVIDER_RECOVERY_NOT_SUPPORTED" : attempts.length >= 5 ? "DELIVERY_RETRY_EXHAUSTED" : "PROVIDER_IDEMPOTENCY_WINDOW_EXCEEDED";
      const retryAt = !expired && safe ? at : null;
      await tx.notificationDeliveryAttempt.updateMany({ where: { deliveryId: candidate.id, status: "STARTED" }, data: { status: "FAILED", completedAt: at, failureClass: "UNKNOWN_PROVIDER_FAILURE", safeProviderCode: "EMAIL_SEND_INTERRUPTED", nextAttemptAt: retryAt } });
      await tx.notificationDelivery.update({ where: { id: candidate.id }, data: { status: expired ? "EXPIRED" : safe ? "FAILED_RETRYABLE" : "FAILED_PERMANENT", eligibilityReason: !expired && !safe ? code : null, nextAttemptAt: retryAt } });
      if (!expired && !safe) { await requireReconciliation(tx, candidate.id, code); return "RECONCILED"; }
      return "RECOVERED";
    });
    if (outcome === "RECOVERED") recovered++;
    if (outcome === "RECONCILED") reconciled++;
  }
  return { examined: candidates.length, recovered, reconciled };
}
