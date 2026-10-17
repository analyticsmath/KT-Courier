import { prisma } from "@/lib/db/prisma";
import { AdminActionType, type Prisma } from "@prisma/client";
import { createDispatchCandidateEvaluation } from "@/lib/services/dispatch-candidate-evidence.service";
import { offerAssignment } from "@/lib/services/dispatch-assignment.service";
import {
  DISPATCH_SYSTEM_ACTOR,
  describeManualDispatchReason,
  dispatchPolicyAllowsRegion,
} from "@/lib/dispatch/automation-policy";
import {
  resolveDispatchAutomationAuthority,
  assertActiveAdminActor,
  assertPolicy,
  DispatchPolicyError,
} from "@/lib/dispatch/automation-policy.service";
import { DispatchError } from "@/lib/dispatch/errors";
import { logApplicationEvent } from "@/lib/observability/logger";

function classifyDispatchFailure(err: unknown): string {
  if (err instanceof DispatchError) {
    return err.code;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("concurrency") || msg.includes("conflict") || msg.includes("stale")) return "CONCURRENCY_CONFLICT";
    if (msg.includes("lock") || msg.includes("timeout") || msg.includes("timed out")) return "LOCK_TIMEOUT";
    if (msg.includes("capacity")) return "CAPACITY_REACHED";
    if (msg.includes("validation")) return "VALIDATION_FAILED";
  }
  return "OFFER_EXECUTION_FAILED";
}

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
 * Checks whether automatic dispatch is active.
 * Fails closed: Requires BOTH setting === true AND an active, approved DispatchAutomationPolicy.
 */
export async function isAutomaticDispatchEnabled(tx?: Prisma.TransactionClient): Promise<boolean> {
  const client = (tx ?? prisma) as Pick<typeof prisma, "systemSetting" | "dispatchAutomationPolicy">;
  const decision = await resolveDispatchAutomationAuthority(client);
  return decision.allowed;
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

export interface RecoverExhaustedDispatchInput {
  bridgeId?: string;
  courierOrderId?: string;
  marketplaceStoreOrderId?: string;
  actorUserId: string;
  reason: string;
  policyReference?: string;
  idempotencyKey?: string;
}

export interface RecoverExhaustedDispatchResult {
  bridgeId: string;
  courierOrderId: string | null;
  status: "RECOVERED" | "IDEMPOTENT_IGNORED";
  recoveredAt: string;
  actorUserId: string;
  idempotencyKey?: string;
}

/**
 * Authorized, auditable operator recovery path for orders stuck in
 * OFFER_CREATION_FAILED_RETRY_EXHAUSTED manual queue.
 *
 * Verifies active admin credentials, enforces idempotency, clears the terminal failure lock,
 * resets consecutive failures to 0, appends EXHAUSTED_DISPATCH_RECOVERED to bridge history,
 * records an AdminActivityLog audit entry, and emits safe application event telemetry.
 */
export async function recoverExhaustedDispatchOrder(
  input: RecoverExhaustedDispatchInput
): Promise<RecoverExhaustedDispatchResult> {
  assertPolicy(
    Boolean(input.bridgeId || input.courierOrderId || input.marketplaceStoreOrderId),
    "DISPATCH_RECOVERY_TARGET_REQUIRED",
    "Must specify bridgeId, courierOrderId, or marketplaceStoreOrderId."
  );
  assertPolicy(
    typeof input.reason === "string" && input.reason.trim().length > 0,
    "DISPATCH_RECOVERY_REASON_REQUIRED",
    "Recovery reason is required."
  );

  await assertActiveAdminActor(prisma, input.actorUserId);

  const bridge = await prisma.marketplaceStoreOrderDeliveryBridge.findFirst({
    where: input.bridgeId
      ? { id: input.bridgeId }
      : input.courierOrderId
      ? { courierOrderId: input.courierOrderId }
      : { marketplaceStoreOrderId: input.marketplaceStoreOrderId! },
  });

  if (!bridge) {
    throw new DispatchPolicyError("DISPATCH_RECOVERY_NOT_FOUND", "Marketplace delivery bridge not found.");
  }

  const existingEvidence = typeof bridge.dispatchEvidence === "object" && bridge.dispatchEvidence !== null
    ? bridge.dispatchEvidence as Record<string, unknown>
    : {};

  // Idempotency check: if this recovery has already been applied with the same idempotencyKey, return early
  if (
    input.idempotencyKey &&
    existingEvidence.lastRecoveryIdempotencyKey === input.idempotencyKey
  ) {
    return {
      bridgeId: bridge.id,
      courierOrderId: bridge.courierOrderId,
      status: "IDEMPOTENT_IGNORED",
      recoveredAt: String(existingEvidence.lastRecoveredAt ?? new Date().toISOString()),
      actorUserId: String(existingEvidence.lastRecoveredByUserId ?? input.actorUserId),
      idempotencyKey: input.idempotencyKey,
    };
  }

  const recoveredAt = new Date().toISOString();
  const recoveryEntry = {
    event: "EXHAUSTED_DISPATCH_RECOVERED",
    timestamp: recoveredAt,
    actorUserId: input.actorUserId,
    reason: input.reason,
    policyReference: input.policyReference ?? (existingEvidence.policyReference as string | undefined) ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.marketplaceStoreOrderDeliveryBridge.update({
      where: { id: bridge.id },
      data: {
        dispatchEvidence: {
          ...existingEvidence,
          manualDispatchRequired: false,
          dispatchRouting: "PENDING_DISPATCH_RETRY",
          manualDispatchResolvedAt: recoveredAt,
          consecutiveFailures: 0,
          reason: null,
          reasonLabel: null,
          actionableNextStep: null,
          lastRecoveredAt: recoveredAt,
          lastRecoveredByUserId: input.actorUserId,
          lastRecoveryReason: input.reason,
          lastRecoveryIdempotencyKey: input.idempotencyKey ?? null,
          history: [
            ...(Array.isArray(existingEvidence.history) ? existingEvidence.history : []),
            recoveryEntry,
          ],
        },
      },
    });

    await tx.adminActivityLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: AdminActionType.STATUS_CHANGE,
        entityType: "MarketplaceStoreOrderDeliveryBridge",
        entityId: bridge.id,
        message: `Authorized recovery of exhausted dispatch order: ${input.reason}`,
        metadata: {
          courierOrderId: bridge.courierOrderId,
          marketplaceStoreOrderId: bridge.marketplaceStoreOrderId,
          reason: input.reason,
          policyReference: input.policyReference ?? existingEvidence.policyReference ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          recoveredAt,
        },
      },
    });
  });

  logApplicationEvent({
    level: "INFO",
    event: "DISPATCH_EXHAUSTED_RETRY_RECOVERED",
    message: "Authorized operator recovered exhausted marketplace dispatch order.",
    actorType: "ADMIN",
    actorReference: input.actorUserId,
    resourceReference: bridge.courierOrderId ?? bridge.id,
    outcome: "SUCCESS",
    context: {
      bridgeId: bridge.id,
      courierOrderId: bridge.courierOrderId,
      reason: input.reason,
      policyReference: input.policyReference ?? existingEvidence.policyReference ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  return {
    bridgeId: bridge.id,
    courierOrderId: bridge.courierOrderId,
    status: "RECOVERED",
    recoveredAt,
    actorUserId: input.actorUserId,
    idempotencyKey: input.idempotencyKey,
  };
}

/**
 * Production worker processor:
 * - Scans marketplace orders ready for pickup with bridged courier orders.
 * - Enforces fail-closed policy gate: offers require both setting === true and an active, approved DispatchAutomationPolicy.
 * - If blocked or outside policy region, routes orders to MANUAL_DISPATCH_REQUIRED with actionable operator steps.
 * - When allowed, evaluates candidates and creates expiring driver offers attributed strictly to DISPATCH_SYSTEM_ACTOR.
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
      NOT: {
        dispatchEvidence: {
          path: ["reason"],
          equals: "OFFER_CREATION_FAILED_RETRY_EXHAUSTED",
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

  const now = new Date();
  const authority = await resolveDispatchAutomationAuthority(prisma, now);
  let completed = 0;
  let reconciled = 0;
  let retried = 0;
  const skipped = 0;

  if (!authority.allowed) {
    const reasonInfo = describeManualDispatchReason(authority.reason);
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
            reason: authority.reason,
            reasonLabel: reasonInfo.label,
            actionableNextStep: reasonInfo.nextStep,
            queuedAt: now.toISOString(),
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
      safeSummary: `Automatic dispatch disabled by policy (${authority.reason}). Routed ${reconciled} order(s) to manual dispatch queue (MANUAL_DISPATCH_REQUIRED).`,
    };
  }

  for (const bridge of candidateBridges) {
    const courierOrderId = bridge.courierOrderId!;
    const deliveryRegionId = bridge.courierOrder?.deliveryRegionId ?? null;

    const existingEvidence = typeof bridge.dispatchEvidence === "object" && bridge.dispatchEvidence !== null
      ? bridge.dispatchEvidence as Record<string, unknown>
      : {};

    const consecutiveFailures = typeof existingEvidence.consecutiveFailures === "number"
      ? existingEvidence.consecutiveFailures
      : 0;

    // P0: Treat OFFER_CREATION_FAILED_RETRY_EXHAUSTED as a terminal automatic-retry state.
    // Keep the order visible in the manual queue and do not call offerAssignment again
    // until an authorized, auditable recovery action explicitly clears or reopens the failure state.
    if (
      existingEvidence.manualDispatchRequired === true &&
      (existingEvidence.reason === "OFFER_CREATION_FAILED_RETRY_EXHAUSTED" || consecutiveFailures >= 3)
    ) {
      reconciled += 1;
      continue;
    }

    try {
      const existingAssignments = await prisma.orderAssignment.findMany({
        where: { orderId: courierOrderId },
        select: { id: true, driverProfileId: true, status: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
      });

      if (existingAssignments.some((a) => a.status === "ACCEPTED")) {
        continue;
      }

      // Check if an offer is currently pending driver acceptance (unexpired)
      const hasActiveUnexpiredOffer = existingAssignments.some(
        (a) => a.status === "ASSIGNED" && (a.expiresAt === null || a.expiresAt > now)
      );

      if (hasActiveUnexpiredOffer) {
        // An active unexpired offer is already outstanding; do not dispatch a concurrent second offer.
        continue;
      }

      // Region check against approved policy scope
      if (!dispatchPolicyAllowsRegion(authority, deliveryRegionId)) {
        const reasonInfo = describeManualDispatchReason("ORDER_REGION_OUTSIDE_POLICY_SCOPE");
        await prisma.marketplaceStoreOrderDeliveryBridge.update({
          where: { id: bridge.id },
          data: {
            dispatchEvidence: {
              ...existingEvidence,
              manualDispatchRequired: true,
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              reason: "ORDER_REGION_OUTSIDE_POLICY_SCOPE",
              reasonLabel: reasonInfo.label,
              actionableNextStep: reasonInfo.nextStep,
              policyReference: authority.policyReference,
              deliveryRegionId,
              queuedAt: new Date().toISOString(),
            },
          },
        });
        reconciled += 1;
        continue;
      }

      // Max attempts check against approved policy limit
      if (existingAssignments.length >= authority.maxOfferAttempts) {
        const reasonInfo = describeManualDispatchReason("MAX_OFFER_ATTEMPTS_EXCEEDED");
        await prisma.marketplaceStoreOrderDeliveryBridge.update({
          where: { id: bridge.id },
          data: {
            dispatchEvidence: {
              ...existingEvidence,
              manualDispatchRequired: true,
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              reason: "MAX_OFFER_ATTEMPTS_EXCEEDED",
              reasonLabel: reasonInfo.label,
              actionableNextStep: reasonInfo.nextStep,
              attemptCount: existingAssignments.length,
              maxAllowedAttempts: authority.maxOfferAttempts,
              queuedAt: new Date().toISOString(),
            },
          },
        });
        reconciled += 1;
        continue;
      }

      // P1: Exclude drivers whose offers were rejected, revoked, expired, OR are currently ASSIGNED but timed out (expiresAt <= now)
      const isExpiredAssignment = (a: { status: string; expiresAt: Date | null }) =>
        a.status === "EXPIRED" || (a.status === "ASSIGNED" && a.expiresAt !== null && a.expiresAt <= now);

      const excludedDriverIds = existingAssignments
        .filter((a) => a.status === "REJECTED" || a.status === "REVOKED" || isExpiredAssignment(a))
        .map((a) => a.driverProfileId);

      const eligible = await findEligibleDriversForOrder(courierOrderId, {
        excludeDriverProfileIds: excludedDriverIds,
        operationId: `${options.operationId}:dsp:${bridge.id}:${existingAssignments.length}`,
      });

      if (eligible.length === 0) {
        const reasonInfo = describeManualDispatchReason("NO_ELIGIBLE_DRIVERS_AVAILABLE");
        await prisma.marketplaceStoreOrderDeliveryBridge.update({
          where: { id: bridge.id },
          data: {
            dispatchEvidence: {
              ...existingEvidence,
              manualDispatchRequired: true,
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              reason: "NO_ELIGIBLE_DRIVERS_AVAILABLE",
              reasonLabel: reasonInfo.label,
              actionableNextStep: reasonInfo.nextStep,
              attemptCount: existingAssignments.length,
              queuedAt: new Date().toISOString(),
            },
          },
        });
        reconciled += 1;
        continue;
      }

      const targetDriver = eligible[0];
      const offer = await offerAssignment(
        {
          systemActor: DISPATCH_SYSTEM_ACTOR,
          policyReference: authority.policyReference,
          dispatchOperationId: options.operationId,
        },
        courierOrderId,
        {
          driverProfileId: targetDriver.driverProfileId,
          reasonCode: "AUTOMATIC_DISPATCH_OFFER",
          adminNote: `Automated marketplace dispatch offer under policy ${authority.policyReference} (attempt ${existingAssignments.length + 1})`,
        }
      );

      const offerHistoryEntry = {
        event: "AUTOMATIC_OFFER_CREATED",
        timestamp: new Date().toISOString(),
        actor: DISPATCH_SYSTEM_ACTOR,
        policyReference: authority.policyReference,
        offeredDriverProfileId: targetDriver.driverProfileId,
        assignmentId: offer.id,
        attemptNumber: existingAssignments.length + 1,
        previousReason: existingEvidence.reason ?? null,
      };

      await prisma.marketplaceStoreOrderDeliveryBridge.update({
        where: { id: bridge.id },
        data: {
          status: "DISPATCH_PENDING",
          dispatchEvidence: {
            ...existingEvidence,
            manualDispatchRequired: false,
            dispatchRouting: "AUTOMATIC_OFFER_ACTIVE",
            manualDispatchResolvedAt: new Date().toISOString(),
            lastOfferedAssignmentId: offer.id,
            offeredDriverProfileId: targetDriver.driverProfileId,
            offeredAt: new Date().toISOString(),
            expiresAt: offer.expiresAt?.toISOString() ?? null,
            attemptNumber: existingAssignments.length + 1,
            policyReference: authority.policyReference,
            systemActor: DISPATCH_SYSTEM_ACTOR,
            consecutiveFailures: 0,
            history: [
              ...(Array.isArray(existingEvidence.history) ? existingEvidence.history : []),
              offerHistoryEntry,
            ],
          },
        },
      });

      completed += 1;
    } catch (err: unknown) {
      const existingEvidence = (typeof bridge.dispatchEvidence === "object" && bridge.dispatchEvidence !== null)
        ? bridge.dispatchEvidence as Record<string, unknown>
        : {};
      const previousFailures = typeof existingEvidence.consecutiveFailures === "number" ? existingEvidence.consecutiveFailures : 0;
      const consecutiveFailures = previousFailures + 1;
      const boundedErrorCode = classifyDispatchFailure(err);
      const isExhausted = consecutiveFailures >= 3;

      // P2: Persist bounded error category, operation ID, policy reference, and timestamp.
      // Raw database/runtime exception messages and stack traces must never be written to long-lived JSON evidence.
      const failureEntry = {
        event: "OFFER_CREATION_FAILED",
        timestamp: new Date().toISOString(),
        operationId: options.operationId,
        policyReference: authority.policyReference,
        consecutiveFailures,
        errorCode: boundedErrorCode,
      };

      logApplicationEvent({
        level: isExhausted ? "ERROR" : "WARN",
        event: "DISPATCH_AUTOMATIC_OFFER_FAILED",
        message: isExhausted
          ? "Automatic dispatch offer creation retry limit exhausted; routed to manual exception queue."
          : "Automatic dispatch offer creation failed transiently; will retry on next cycle.",
        operation: options.operationId,
        actorType: "SYSTEM",
        actorReference: DISPATCH_SYSTEM_ACTOR,
        resourceReference: courierOrderId,
        outcome: isExhausted ? "FAILURE" : "RETRY",
        errorCategory: boundedErrorCode,
        context: {
          bridgeId: bridge.id,
          courierOrderId,
          consecutiveFailures,
          isExhausted,
          policyReference: authority.policyReference,
          rawError: err instanceof Error ? err.message : String(err),
        },
      });

      if (isExhausted) {
        const reasonInfo = describeManualDispatchReason("OFFER_CREATION_FAILED_RETRY_EXHAUSTED");
        await prisma.marketplaceStoreOrderDeliveryBridge.update({
          where: { id: bridge.id },
          data: {
            dispatchEvidence: {
              ...existingEvidence,
              manualDispatchRequired: true,
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              reason: "OFFER_CREATION_FAILED_RETRY_EXHAUSTED",
              reasonLabel: reasonInfo.label,
              actionableNextStep: reasonInfo.nextStep,
              consecutiveFailures,
              failureCount: consecutiveFailures,
              lastFailedAt: new Date().toISOString(),
              lastErrorCode: boundedErrorCode,
              policyReference: authority.policyReference,
              operationId: options.operationId,
              history: [
                ...(Array.isArray(existingEvidence.history) ? existingEvidence.history : []),
                failureEntry,
              ],
            },
          },
        });
        reconciled += 1;
      } else {
        await prisma.marketplaceStoreOrderDeliveryBridge.update({
          where: { id: bridge.id },
          data: {
            dispatchEvidence: {
              ...existingEvidence,
              consecutiveFailures,
              failureCount: consecutiveFailures,
              lastFailedAt: new Date().toISOString(),
              lastErrorCode: boundedErrorCode,
              policyReference: authority.policyReference,
              operationId: options.operationId,
              history: [
                ...(Array.isArray(existingEvidence.history) ? existingEvidence.history : []),
                failureEntry,
              ],
            },
          },
        });
        retried += 1;
      }
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
