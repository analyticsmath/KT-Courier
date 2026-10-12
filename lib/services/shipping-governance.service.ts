/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { createHash } from "node:crypto";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import type { PrismaTransactionClient } from "@/lib/db/transaction-runner";
import { phase5Reference, safeOperationalText } from "@/lib/operations/phase5-repository";
export const SHIPPING_LAUNCH_SCOPES = ["FULL_DIGITAL", "QUOTE_REQUEST", "LEAD_ONLY", "DISABLED"] as const;
export class ShippingGovernanceError extends Error { constructor(readonly code: string) { super(code); } }
export async function listLaunchableDeliveryServices() { return (prisma as any).deliveryServiceDefinition.findMany({ where: { status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, select: { stableKey: true, versionNumber: true, displayName: true, operationalMode: true, launchScope: true, slaMetadata: true, coveragePolicy: true, effectiveFrom: true }, orderBy: [{ sortOrder: "asc" }, { versionNumber: "desc" }] }); }
export async function requestRedelivery(input: { orderId: string; requesterUserId: string; operationId: string; safeNote?: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`redelivery-request:${input.operationId}`}))`;
    await tx.$queryRaw`SELECT o.id FROM "Order" o JOIN "User" u ON u.id = o."customerId" WHERE o.id = ${input.orderId} FOR UPDATE OF o, u`;
    const order = await tx.order.findUnique({ where: { id: input.orderId }, select: { customerId: true, status: true } });
    const actor = await tx.user.findUnique({ where: { id: input.requesterUserId }, select: { status: true } });
    if (!order || order.customerId !== input.requesterUserId || actor?.status !== "ACTIVE") throw new ShippingGovernanceError("REDELIVERY_NOT_OWNER");
    if (order.status !== "DELIVERY_ATTEMPTED") throw new ShippingGovernanceError("REDELIVERY_NOT_ELIGIBLE");
    const prior = await tx.deliveryAttempt.findFirst({ where: { orderId: input.orderId, retryable: true }, orderBy: { attemptNumber: "desc" } });
    if (!prior) throw new ShippingGovernanceError("REDELIVERY_NOT_ELIGIBLE");
    const safeNote = input.safeNote ? safeOperationalText(input.safeNote, 240) : null;
    const replay = await tx.redeliveryRequest.findUnique({ where: { operationId: input.operationId } });
    if (replay) {
      if (replay.orderId !== input.orderId || replay.requestedByUserId !== input.requesterUserId || replay.priorAttemptId !== prior.id || replay.safeNote !== safeNote) throw new ShippingGovernanceError("REDELIVERY_OPERATION_CONFLICT");
      return replay;
    }
    const active = await tx.redeliveryRequest.findFirst({ where: { orderId: input.orderId, status: { in: ["REQUESTED", "SCHEDULED"] } } });
    if (active) throw new ShippingGovernanceError("REDELIVERY_ALREADY_REQUESTED");
    return tx.redeliveryRequest.create({ data: { publicReference: phase5Reference("RED"), orderId: input.orderId, priorAttemptId: prior.id, requestedByUserId: input.requesterUserId, operationId: input.operationId, safeNote, commercialEvidence: { status: "CLIENT_VALUE_REQUIRED", feeRule: "NO_HARDCODED_REDELIVERY_FEE" } } });
  });
}

export async function scheduleRedelivery(input: { actorUserId: string; publicReference: string; scheduledFor: Date; responsibilityCode: string; operationId: string; expectedUpdatedAt?: Date }) {
  if (!Number.isFinite(input.scheduledFor.getTime()) || (input.expectedUpdatedAt && !Number.isFinite(input.expectedUpdatedAt.getTime()))) throw new ShippingGovernanceError("REDELIVERY_SCHEDULE_INVALID");
  const responsibilityCode = safeOperationalText(input.responsibilityCode, 80);
  const requestHash = createHash("sha256").update(JSON.stringify({ actorUserId: input.actorUserId, publicReference: input.publicReference, scheduledFor: input.scheduledFor.toISOString(), responsibilityCode, expectedUpdatedAt: input.expectedUpdatedAt?.toISOString() ?? null })).digest("hex");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`redelivery-schedule:${input.operationId}`}))`;
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.actorUserId} FOR UPDATE`;
    const actor = await tx.user.findUnique({ where: { id: input.actorUserId }, select: { role: true, status: true } });
    if (!actor || actor.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(actor.role)) throw new ShippingGovernanceError("REDELIVERY_SCHEDULE_FORBIDDEN");
    if (actor.role !== "SUPER_ADMIN") {
      const permission = await tx.permission.findUnique({ where: { key: PERMISSIONS.DELIVERIES_REDELIVERY_MANAGE }, include: { rolePermissions: { where: { role: actor.role, enabled: true }, take: 1 }, userPermissions: { where: { userId: input.actorUserId }, take: 1 } } });
      const override = permission?.userPermissions[0]?.effect;
      const allowed = override === "ALLOW" || (override !== "DENY" && Boolean(permission?.rolePermissions.length));
      if (!allowed && (permission || await tx.permission.count() > 0)) throw new ShippingGovernanceError("REDELIVERY_SCHEDULE_FORBIDDEN");
    }
    await tx.$queryRaw`SELECT id FROM "RedeliveryRequest" WHERE "publicReference" = ${input.publicReference} FOR UPDATE`;
    const request = await tx.redeliveryRequest.findUnique({ where: { publicReference: input.publicReference } });
    if (!request) throw new ShippingGovernanceError("REDELIVERY_NOT_FOUND");
    const evidence = request.commercialEvidence && typeof request.commercialEvidence === "object" && !Array.isArray(request.commercialEvidence) ? request.commercialEvidence : {};
    const priorReceipt = evidence.scheduleReceipt as { operationId?: string; requestHash?: string } | undefined;
    const operationReceipt = await tx.adminActivityLog.findFirst({ where: { entityType: "RedeliveryRequest", metadata: { path: ["operationId"], equals: input.operationId } } });
    if (operationReceipt || priorReceipt?.operationId === input.operationId) {
      if (operationReceipt?.entityId !== request.id || priorReceipt?.operationId !== input.operationId || priorReceipt.requestHash !== requestHash) throw new ShippingGovernanceError("REDELIVERY_OPERATION_CONFLICT");
      return request;
    }
    if (request.operationId === input.operationId) throw new ShippingGovernanceError("REDELIVERY_OPERATION_CONFLICT");
    if (input.expectedUpdatedAt && request.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) throw new ShippingGovernanceError("REDELIVERY_VERSION_CONFLICT");
    if (request.status !== "REQUESTED") throw new ShippingGovernanceError("REDELIVERY_INVALID_TRANSITION");
    const updated = await tx.redeliveryRequest.update({ where: { id: request.id, updatedAt: request.updatedAt }, data: { status: "SCHEDULED", scheduledFor: input.scheduledFor, responsibilityCode, decidedByUserId: input.actorUserId, decidedAt: new Date(), commercialEvidence: { ...evidence, scheduleReceipt: { operationId: input.operationId, requestHash } } } });
    await tx.adminActivityLog.create({ data: { actorUserId: input.actorUserId, action: "STATUS_CHANGE", entityType: "RedeliveryRequest", entityId: request.id, message: "Scheduled redelivery", metadata: { operationId: input.operationId, requestHash, reference: request.publicReference } } });
    return updated;
  });
}
/** Claims own remedy decisions; Shipping owns the actual controlled redelivery
 * request. This creates no assignment, payment, or altered delivery history. */
type ClaimFulfilmentRemedyInput = { claimId: string; orderId: string; claimantUserId: string; remedyType: "REDELIVERY" | "REPLACEMENT"; operationId: string };

/**
 * Canonical Shipping authority for a Claim-owned transaction.  It deliberately
 * receives the parent client so a Claim retry cannot leave behind a committed
 * redelivery request when the parent decision is rolled back.
 */
export async function requestClaimFulfilmentRemedyInTransaction(tx: PrismaTransactionClient, input: ClaimFulfilmentRemedyInput) {
  const existing = await tx.redeliveryRequest.findFirst({
    where: { OR: [{ sourceClaimId: input.claimId }, { operationId: input.operationId }] },
  });
  if (existing) return existing;
  const order = await tx.order.findUnique({ where: { id: input.orderId }, select: { id: true } });
  if (!order) throw new ShippingGovernanceError("CLAIM_REDELIVERY_ORDER_NOT_FOUND");
  try {
    return await tx.redeliveryRequest.create({ data: {
      publicReference: phase5Reference("RED"), orderId: input.orderId,
      priorAttemptId: `CLAIM:${input.claimId}`, sourceClaimId: input.claimId,
      remedyType: input.remedyType, requestedByUserId: input.claimantUserId,
      operationId: input.operationId,
      commercialEvidence: { source: "CLAIM_REMEDY", status: "CLIENT_VALUE_REQUIRED", feeRule: "NO_HARDCODED_REDELIVERY_FEE" },
    } });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2002") {
      const winner = await tx.redeliveryRequest.findFirst({
        where: { OR: [{ sourceClaimId: input.claimId }, { operationId: input.operationId }] },
      });
      if (winner) return winner;
    }
    throw error;
  }
}

export async function requestClaimFulfilmentRemedy(input: ClaimFulfilmentRemedyInput) {
  return prisma.$transaction((tx) => requestClaimFulfilmentRemedyInTransaction(tx, input));
}
