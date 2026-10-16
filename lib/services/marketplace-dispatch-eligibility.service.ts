import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { UserRole, UserStatus } from "@/types/db";
import { createDispatchCandidateEvaluation } from "@/lib/services/dispatch-candidate-evidence.service";
import { offerAssignment } from "@/lib/services/dispatch-assignment.service";

/** Phase 7 composition boundary: schedules eligibility evidence only, never a driver. */
export async function scheduleMarketplaceDispatchEligibility(input: Readonly<{
  courierOrderId: string;
  storeOrderReference: string;
  expectedReadyAt: Date;
  deliveryQuoteReference: string;
  operationId: string;
}>) {
  const order = await prisma.order.findUnique({
    where: { id: input.courierOrderId },
    select: { id: true, status: true, deliveryRegionId: true, scheduledFor: true },
  });
  if (!order || !["CONFIRMED", "PICKUP_SCHEDULED"].includes(order.status) || !order.deliveryRegionId) {
    throw new Error("Canonical courier order is not eligible for Phase 7 dispatch scheduling.");
  }
  return Object.freeze({
    phase: "PHASE_7_DISPATCH_ELIGIBILITY",
    courierOrderId: order.id,
    serviceabilityEvidence: "FROZEN_PHASE6_QUOTE",
    deliveryQuoteReference: input.deliveryQuoteReference,
    expectedReadyAt: input.expectedReadyAt.toISOString(),
    operationId: input.operationId,
    driverSelected: false,
  });
}

export interface EligibleDispatchDriver {
  driverProfileId: string;
  driverCode: string;
  displayName: string | null;
  rank: number;
}

/**
 * Queries active, eligible drivers for a canonical courier order using authoritative
 * candidate evaluation, compliance evidence, and deterministic ranking.
 */
export async function findEligibleDriversForOrder(
  courierOrderId: string,
  options?: {
    excludeDriverProfileIds?: string[];
    operationId?: string;
  }
): Promise<EligibleDispatchDriver[]> {
  const operationId = options?.operationId ?? `find-drivers:${courierOrderId}:${Date.now()}`;
  const evaluation = await createDispatchCandidateEvaluation({
    courierOrderId,
    operationId,
  });

  const excluded = new Set(options?.excludeDriverProfileIds ?? []);
  return evaluation.candidates
    .filter((candidate) => candidate.eligible && !excluded.has(candidate.driverProfileId))
    .sort((a, b) => a.rank - b.rank)
    .map((candidate) => ({
      driverProfileId: candidate.driverProfileId,
      driverCode: candidate.driverCode,
      displayName: candidate.displayName,
      rank: candidate.rank,
    }));
}

/**
 * Checks system setting for whether automatic dispatch is active.
 * Fails closed if explicitly disabled in SystemSetting.
 */
export async function isAutomaticDispatchEnabled(tx?: Prisma.TransactionClient): Promise<boolean> {
  const client = tx ?? prisma;
  const setting = await client.systemSetting.findUnique({
    where: { key: "dispatch.auto_dispatch_enabled" },
    select: { value: true },
  });
  if (!setting || setting.value === null || setting.value === undefined) return true;
  if (typeof setting.value === "boolean") return setting.value;
  if (typeof setting.value === "string") return setting.value.toLowerCase() !== "false";
  return true;
}

async function resolveDispatchActorUserId(requestedUserId?: string): Promise<string> {
  if (requestedUserId) {
    const user = await prisma.user.findUnique({ where: { id: requestedUserId }, select: { id: true } });
    if (user) return user.id;
  }
  const admin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (admin) return admin.id;

  const fallback = await prisma.user.findFirst({
    where: { status: UserStatus.ACTIVE },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (fallback) return fallback.id;
  throw new Error("No active user available for dispatch authority.");
}

export interface MarketplaceDispatchBatchOptions {
  mode: "DRY_RUN" | "APPLY";
  batchSize?: number;
  operationId: string;
  actorUserId?: string;
}

export interface MarketplaceDispatchBatchOutcome {
  itemsExamined: number;
  itemsClaimed: number;
  itemsCompleted: number;
  itemsSkipped: number;
  itemsRetried: number;
  itemsReconciled: number;
  safeSummary: string;
}

/**
 * Production worker processor:
 * - Scans marketplace orders ready for pickup with bridged courier orders.
 * - Enforces policy gate: if auto-dispatch is disabled by policy, routes orders to MANUAL_DISPATCH_REQUIRED.
 * - If enabled, evaluates candidates, creates expiring driver offers with TTL, and bounds retries.
 * - If drivers are unavailable or max attempts reached, routes orders to actionable manual dispatch queue.
 */
export async function dispatchReadyMarketplaceOrdersBatch(
  options: MarketplaceDispatchBatchOptions
): Promise<MarketplaceDispatchBatchOutcome> {
  const batchLimit = Math.min(100, Math.max(1, options.batchSize ?? 20));

  const candidateBridges = await prisma.marketplaceStoreOrderDeliveryBridge.findMany({
    where: {
      courierOrderId: { not: null },
      status: { in: ["DISPATCH_PENDING", "DELIVERY_ORDER_CREATED"] },
      storeOrder: {
        acceptanceStatus: "ACCEPTED",
        OR: [
          { derivedStatus: "READY_FOR_PICKUP" },
          { preparationStatus: "READY_FOR_HANDOFF" },
        ],
      },
      courierOrder: {
        status: { in: ["CONFIRMED", "PICKUP_SCHEDULED"] },
        assignments: {
          none: {
            status: { in: ["ASSIGNED", "ACCEPTED"] },
            OR: [
              { status: "ACCEPTED" },
              { status: "ASSIGNED", expiresAt: { gt: new Date() } },
              { status: "ASSIGNED", expiresAt: null },
            ],
          },
        },
      },
    },
    include: {
      storeOrder: {
        select: { id: true, publicReference: true, derivedStatus: true },
      },
      courierOrder: {
        select: { id: true, status: true, deliveryRegionId: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: batchLimit,
  });

  if (options.mode === "DRY_RUN") {
    return {
      itemsExamined: candidateBridges.length,
      itemsClaimed: 0,
      itemsCompleted: 0,
      itemsSkipped: candidateBridges.length,
      itemsRetried: 0,
      itemsReconciled: 0,
      safeSummary: `[DRY_RUN] Found ${candidateBridges.length} marketplace order(s) ready for dispatch evaluation.`,
    };
  }

  const autoDispatch = await isAutomaticDispatchEnabled();
  let completed = 0;
  let reconciled = 0;
  let retried = 0;
  const skipped = 0;

  if (!autoDispatch) {
    for (const bridge of candidateBridges) {
      const existingEvidence = typeof bridge.dispatchEvidence === "object" && bridge.dispatchEvidence !== null
        ? bridge.dispatchEvidence as Record<string, unknown>
        : {};
      await prisma.marketplaceStoreOrderDeliveryBridge.update({
        where: { id: bridge.id },
        data: {
          dispatchEvidence: {
            ...existingEvidence,
            manualDispatchRequired: true,
            dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
            policyGate: "AUTO_DISPATCH_DISABLED_BY_POLICY",
            queuedAt: new Date().toISOString(),
          },
        },
      });
      reconciled += 1;
    }
    return {
      itemsExamined: candidateBridges.length,
      itemsClaimed: candidateBridges.length,
      itemsCompleted: 0,
      itemsSkipped: 0,
      itemsRetried: 0,
      itemsReconciled: reconciled,
      safeSummary: `Automatic dispatch disabled by policy. Routed ${reconciled} order(s) to manual dispatch queue (MANUAL_DISPATCH_REQUIRED).`,
    };
  }

  const actorUserId = await resolveDispatchActorUserId(options.actorUserId);
  const MAX_DISPATCH_OFFER_ATTEMPTS = 3;

  for (const bridge of candidateBridges) {
    const courierOrderId = bridge.courierOrderId!;
    try {
      const existingAssignments = await prisma.orderAssignment.findMany({
        where: { orderId: courierOrderId },
        select: { id: true, driverProfileId: true, status: true },
        orderBy: { createdAt: "desc" },
      });

      const existingEvidence = typeof bridge.dispatchEvidence === "object" && bridge.dispatchEvidence !== null
        ? bridge.dispatchEvidence as Record<string, unknown>
        : {};

      if (existingAssignments.length >= MAX_DISPATCH_OFFER_ATTEMPTS) {
        await prisma.marketplaceStoreOrderDeliveryBridge.update({
          where: { id: bridge.id },
          data: {
            dispatchEvidence: {
              ...existingEvidence,
              manualDispatchRequired: true,
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              reason: "MAX_OFFER_ATTEMPTS_EXCEEDED",
              attemptCount: existingAssignments.length,
              queuedAt: new Date().toISOString(),
            },
          },
        });
        reconciled += 1;
        continue;
      }

      const excludedDriverIds = existingAssignments
        .filter((a) => a.status === "REJECTED" || a.status === "EXPIRED" || a.status === "REVOKED")
        .map((a) => a.driverProfileId);

      const eligible = await findEligibleDriversForOrder(courierOrderId, {
        excludeDriverProfileIds: excludedDriverIds,
        operationId: `${options.operationId}:dsp:${bridge.id}:${existingAssignments.length}`,
      });

      if (eligible.length === 0) {
        await prisma.marketplaceStoreOrderDeliveryBridge.update({
          where: { id: bridge.id },
          data: {
            dispatchEvidence: {
              ...existingEvidence,
              manualDispatchRequired: true,
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              reason: "NO_ELIGIBLE_DRIVERS_AVAILABLE",
              attemptCount: existingAssignments.length,
              queuedAt: new Date().toISOString(),
            },
          },
        });
        reconciled += 1;
        continue;
      }

      const targetDriver = eligible[0];
      const offer = await offerAssignment(actorUserId, courierOrderId, {
        driverProfileId: targetDriver.driverProfileId,
        reasonCode: "AUTOMATIC_DISPATCH_OFFER",
        adminNote: `System automated dispatch offer (attempt ${existingAssignments.length + 1})`,
      });

      await prisma.marketplaceStoreOrderDeliveryBridge.update({
        where: { id: bridge.id },
        data: {
          status: "DISPATCH_PENDING",
          dispatchEvidence: {
            ...existingEvidence,
            lastOfferedAssignmentId: offer.id,
            offeredDriverProfileId: targetDriver.driverProfileId,
            offeredAt: new Date().toISOString(),
            expiresAt: offer.expiresAt?.toISOString() ?? null,
            attemptNumber: existingAssignments.length + 1,
          },
        },
      });

      completed += 1;
    } catch {
      retried += 1;
    }
  }

  return {
    itemsExamined: candidateBridges.length,
    itemsClaimed: completed + reconciled + retried,
    itemsCompleted: completed,
    itemsSkipped: skipped,
    itemsRetried: retried,
    itemsReconciled: reconciled,
    safeSummary: `Processed ${candidateBridges.length} ready marketplace order(s): ${completed} offer(s) created, ${reconciled} routed to manual dispatch queue, ${retried} retries.`,
  };
}
