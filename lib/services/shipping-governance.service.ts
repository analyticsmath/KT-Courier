import { prisma } from "@/lib/db/prisma";
import type { PrismaTransactionClient } from "@/lib/db/transaction-runner";
import { phase5Reference, safeOperationalText } from "@/lib/operations/phase5-repository";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
export const SHIPPING_LAUNCH_SCOPES = ["FULL_DIGITAL", "QUOTE_REQUEST", "LEAD_ONLY", "DISABLED"] as const;
export class ShippingGovernanceError extends Error { constructor(readonly code: string) { super(code); } }
export async function listLaunchableDeliveryServices() { return (prisma as any).deliveryServiceDefinition.findMany({ where: { status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, select: { stableKey: true, versionNumber: true, displayName: true, operationalMode: true, launchScope: true, slaMetadata: true, coveragePolicy: true, effectiveFrom: true }, orderBy: [{ sortOrder: "asc" }, { versionNumber: "desc" }] }); }
export async function requestRedelivery(input: { orderId: string; requesterUserId: string; operationId: string; safeNote?: string }) { const client = prisma as any; const replay = await client.redeliveryRequest.findUnique({ where: { operationId: input.operationId } }); if (replay) return replay; const order = await client.order.findUnique({ where: { id: input.orderId }, select: { customerId: true, status: true } }); if (!order || order.customerId !== input.requesterUserId) throw new ShippingGovernanceError("REDELIVERY_NOT_OWNER"); if (order.status !== "DELIVERY_ATTEMPTED") throw new ShippingGovernanceError("REDELIVERY_NOT_ELIGIBLE"); const prior = await client.deliveryAttempt.findFirst({ where: { orderId: input.orderId, retryable: true }, orderBy: { attemptNumber: "desc" } }); if (!prior) throw new ShippingGovernanceError("REDELIVERY_NOT_ELIGIBLE"); const active = await client.redeliveryRequest.findFirst({ where: { orderId: input.orderId, status: { in: ["REQUESTED", "SCHEDULED"] } } }); if (active) throw new ShippingGovernanceError("REDELIVERY_ALREADY_REQUESTED"); return client.redeliveryRequest.create({ data: { publicReference: phase5Reference("RED"), orderId: input.orderId, priorAttemptId: prior.id, requestedByUserId: input.requesterUserId, operationId: input.operationId, safeNote: input.safeNote ? safeOperationalText(input.safeNote, 240) : null, commercialEvidence: { status: "CLIENT_VALUE_REQUIRED", feeRule: "NO_HARDCODED_REDELIVERY_FEE" } } }); }
export async function scheduleRedelivery(input: { actorUserId: string; publicReference: string; scheduledFor: Date; responsibilityCode: string; operationId: string }) { const client = prisma as any; const request = await client.redeliveryRequest.findUnique({ where: { publicReference: input.publicReference } }); if (!request) throw new ShippingGovernanceError("REDELIVERY_NOT_FOUND"); if (request.status !== "REQUESTED") throw new ShippingGovernanceError("REDELIVERY_INVALID_TRANSITION"); const updated = await client.redeliveryRequest.update({ where: { id: request.id }, data: { status: "SCHEDULED", scheduledFor: input.scheduledFor, responsibilityCode: safeOperationalText(input.responsibilityCode, 80), decidedByUserId: input.actorUserId, decidedAt: new Date() } }); await recordAdminActivity({ actorUserId: input.actorUserId, action: "STATUS_CHANGE", entityType: "RedeliveryRequest", entityId: request.id, message: "Scheduled redelivery", metadata: { operationId: input.operationId, reference: request.publicReference } }); return updated; }
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
