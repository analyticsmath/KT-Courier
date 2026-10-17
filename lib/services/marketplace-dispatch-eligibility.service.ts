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
import { RECOVERY_IDEMPOTENCY_KEY_PATTERN, RECOVERY_REASON_MAX_LENGTH } from "@/lib/dispatch/recovery-constants";

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

const EXHAUSTED_DISPATCH_REASON = "OFFER_CREATION_FAILED_RETRY_EXHAUSTED";
const EXHAUSTED_RECOVERY_EVENT = "EXHAUSTED_DISPATCH_RECOVERED";


export interface RecoverExhaustedDispatchInput {
  bridgeId?: string;
  courierOrderId?: string;
  marketplaceStoreOrderId?: string;
  actorUserId: string;
  reason: string;
  policyReference?: string;
  /** Mandatory: 8-128 chars of [A-Za-z0-9._:-]. Scopes exactly one recovery transition per bridge. */
  idempotencyKey: string;
}

export interface RecoverExhaustedDispatchResult {
  bridgeId: string;
  courierOrderId: string | null;
  status: "RECOVERED";
  /** True when this call replayed the original recovery for the same idempotency key (no new writes). */
  replayed: boolean;
  recoveredAt: string;
  actorUserId: string;
  idempotencyKey: string;
}

function asEvidenceRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function findRecoveryReplayEntry(
  evidence: Record<string, unknown>,
  idempotencyKey: string
): Record<string, unknown> | null {
  const history = Array.isArray(evidence.history) ? evidence.history : [];
  for (const entry of history) {
    const record = asEvidenceRecord(entry);
    if (record.event === EXHAUSTED_RECOVERY_EVENT && record.idempotencyKey === idempotencyKey) {
      return record;
    }
  }
  return null;
}

/**
 * Authorized, auditable operator recovery for orders parked in the terminal
 * OFFER_CREATION_FAILED_RETRY_EXHAUSTED manual-queue state.
 *
 * Every authoritative check and the write happen inside ONE transaction:
 * 1. the actor is re-verified as an active administrator;
 * 2. a prior recovery with the same idempotency key is replayed (no writes) when found in durable
 *    bridge history; a key reused by a different actor is rejected;
 * 3. the bridge must currently be manualDispatchRequired === true with the exhausted reason, still be
 *    awaiting dispatch, and its courier order must have no live assignment;
 * 4. the transition is a compare-and-set (updatedAt + the exhausted JSON state) so a stale read or a
 *    concurrent dispatch/recovery cannot clear a changed row. A lost race re-reads the committed row:
 *    same key => replay, anything else => a state conflict.
 * The success audit entry is created only after the compare-and-set wins.
 */
export async function recoverExhaustedDispatchOrder(
  input: RecoverExhaustedDispatchInput
): Promise<RecoverExhaustedDispatchResult> {
  const specifiedTargets = [
    input.bridgeId ? { field: "bridgeId" as const, value: input.bridgeId } : null,
    input.courierOrderId ? { field: "courierOrderId" as const, value: input.courierOrderId } : null,
    input.marketplaceStoreOrderId ? { field: "marketplaceStoreOrderId" as const, value: input.marketplaceStoreOrderId } : null,
  ].filter((t): t is { field: "bridgeId" | "courierOrderId" | "marketplaceStoreOrderId"; value: string } => t !== null);

  assertPolicy(
    specifiedTargets.length === 1,
    "DISPATCH_RECOVERY_TARGET_REQUIRED",
    specifiedTargets.length === 0
      ? "Must specify exactly one target selector (bridgeId, courierOrderId, or marketplaceStoreOrderId)."
      : `Multiple conflicting target selectors provided (${specifiedTargets.map((t) => t.field).join(", ")}). Must specify exactly one target selector.`
  );
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  assertPolicy(reason.length > 0, "DISPATCH_RECOVERY_REASON_REQUIRED", "Recovery reason is required.");
  assertPolicy(
    reason.length <= RECOVERY_REASON_MAX_LENGTH,
    "DISPATCH_RECOVERY_REASON_TOO_LONG",
    `Recovery reason must be at most ${RECOVERY_REASON_MAX_LENGTH} characters.`
  );
  assertPolicy(
    typeof input.idempotencyKey === "string" && RECOVERY_IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey),
    "DISPATCH_RECOVERY_IDEMPOTENCY_KEY_INVALID",
    "A valid idempotency key (8-128 characters of letters, digits, '.', '_', ':' or '-') is required."
  );
  const idempotencyKey = input.idempotencyKey;

  const target = specifiedTargets[0];
  const targetWhere =
    target.field === "bridgeId"
      ? { id: target.value }
      : target.field === "courierOrderId"
        ? { courierOrderId: target.value }
        : { marketplaceStoreOrderId: target.value };

  const outcome = await prisma.$transaction(async (tx) => {
    await assertActiveAdminActor(tx, input.actorUserId);

    const loadBridge = () =>
      tx.marketplaceStoreOrderDeliveryBridge.findFirst({
        where: targetWhere,
        select: {
          id: true,
          courierOrderId: true,
          marketplaceStoreOrderId: true,
          status: true,
          dispatchEvidence: true,
          updatedAt: true,
          courierOrder: { select: { status: true } },
          storeOrder: {
            select: {
              id: true,
              status: true,
              acceptanceStatus: true,
              derivedStatus: true,
              preparationStatus: true,
            },
          },
        },
      });

    const replayFrom = (
      bridge: { id: string; courierOrderId: string | null },
      entry: Record<string, unknown>
    ): RecoverExhaustedDispatchResult => {
      assertPolicy(
        entry.actorUserId === input.actorUserId,
        "DISPATCH_RECOVERY_IDEMPOTENCY_KEY_REUSED",
        "This idempotency key was already used by a different administrator."
      );
      return {
        bridgeId: bridge.id,
        courierOrderId: bridge.courierOrderId,
        status: "RECOVERED",
        replayed: true,
        recoveredAt: String(entry.timestamp),
        actorUserId: String(entry.actorUserId),
        idempotencyKey,
      };
    };

    const bridge = await loadBridge();
    if (!bridge) {
      throw new DispatchPolicyError("DISPATCH_RECOVERY_NOT_FOUND", "Marketplace delivery bridge not found.");
    }

    const evidence = asEvidenceRecord(bridge.dispatchEvidence);

    const priorRecovery = findRecoveryReplayEntry(evidence, idempotencyKey);
    if (priorRecovery) return replayFrom(bridge, priorRecovery);

    assertPolicy(
      evidence.manualDispatchRequired === true && evidence.reason === EXHAUSTED_DISPATCH_REASON,
      "DISPATCH_RECOVERY_STATE_CONFLICT",
      "Order is not in the exhausted automatic-dispatch state; recovery was not applied."
    );
    assertPolicy(
      bridge.courierOrderId &&
        (bridge.status === "DISPATCH_PENDING" || bridge.status === "DELIVERY_ORDER_CREATED") &&
        (bridge.courierOrder?.status === "CONFIRMED" || bridge.courierOrder?.status === "PICKUP_SCHEDULED"),
      "DISPATCH_RECOVERY_STATE_CONFLICT",
      "Order is no longer awaiting dispatch; recovery was not applied."
    );

    // Validate store order acceptance and readiness before clearing manual state.
    // If the store order ceased to be accepted or ready for pickup/handoff while in the exception
    // queue, reject recovery so the order cannot disappear from the actionable exception workflow.
    assertPolicy(
      Boolean(bridge.storeOrder),
      "DISPATCH_RECOVERY_STORE_ORDER_NOT_FOUND",
      "Related marketplace store order not found; recovery was not applied."
    );
    const storeOrder = bridge.storeOrder!;
    const isStoreOrderAccepted = storeOrder.acceptanceStatus === "ACCEPTED";
    const isStoreOrderReady =
      storeOrder.derivedStatus === "READY_FOR_PICKUP" ||
      storeOrder.preparationStatus === "READY_FOR_HANDOFF";
    assertPolicy(
      isStoreOrderAccepted && isStoreOrderReady,
      "DISPATCH_RECOVERY_STORE_ORDER_NOT_READY",
      `Related marketplace store order is not in an accepted and ready-for-pickup state (acceptanceStatus: ${storeOrder.acceptanceStatus}, derivedStatus: ${storeOrder.derivedStatus}, preparationStatus: ${storeOrder.preparationStatus}); recovery was not applied.`
    );

    const activeAssignment = await tx.orderAssignment.findFirst({
      where: {
        orderId: bridge.courierOrderId!,
        OR: [
          { status: "ACCEPTED" },
          { status: "ASSIGNED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ],
      },
      select: { id: true },
    });
    assertPolicy(
      !activeAssignment,
      "DISPATCH_RECOVERY_STATE_CONFLICT",
      "Order already has a live driver assignment; recovery was not applied."
    );

    const recoveredAt = new Date().toISOString();
    const policyReference =
      input.policyReference ?? (typeof evidence.policyReference === "string" ? evidence.policyReference : null);
    const recoveryEntry = {
      event: EXHAUSTED_RECOVERY_EVENT,
      timestamp: recoveredAt,
      actorUserId: input.actorUserId,
      reason,
      policyReference,
      idempotencyKey,
    };

    const swapped = await tx.marketplaceStoreOrderDeliveryBridge.updateMany({
      where: {
        id: bridge.id,
        updatedAt: bridge.updatedAt,
        AND: [
          { dispatchEvidence: { path: ["manualDispatchRequired"], equals: true } },
          { dispatchEvidence: { path: ["reason"], equals: EXHAUSTED_DISPATCH_REASON } },
        ],
      },
      data: {
        dispatchEvidence: {
          ...evidence,
          manualDispatchRequired: false,
          dispatchRouting: "PENDING_DISPATCH_RETRY",
          manualDispatchResolvedAt: recoveredAt,
          consecutiveFailures: 0,
          reason: null,
          reasonLabel: null,
          actionableNextStep: null,
          lastRecoveredAt: recoveredAt,
          lastRecoveredByUserId: input.actorUserId,
          lastRecoveryReason: reason,
          lastRecoveryIdempotencyKey: idempotencyKey,
          history: [...(Array.isArray(evidence.history) ? evidence.history : []), recoveryEntry],
        },
      },
    });

    if (swapped.count !== 1) {
      // Lost a race with a concurrent recovery/dispatch. Re-read the committed row: the same key is a
      // replay of the winner; anything else is a conflict. No evidence or audit write happens here.
      const current = await loadBridge();
      const winner = current ? findRecoveryReplayEntry(asEvidenceRecord(current.dispatchEvidence), idempotencyKey) : null;
      if (current && winner) return replayFrom(current, winner);
      throw new DispatchPolicyError(
        "DISPATCH_RECOVERY_STATE_CONFLICT",
        "Dispatch state changed concurrently; recovery was not applied."
      );
    }

    await tx.adminActivityLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: AdminActionType.STATUS_CHANGE,
        entityType: "MarketplaceStoreOrderDeliveryBridge",
        entityId: bridge.id,
        message: `Authorized recovery of exhausted dispatch order: ${reason}`,
        metadata: {
          courierOrderId: bridge.courierOrderId,
          marketplaceStoreOrderId: bridge.marketplaceStoreOrderId,
          reason,
          policyReference,
          idempotencyKey,
          recoveredAt,
        },
      },
    });

    return {
      bridgeId: bridge.id,
      courierOrderId: bridge.courierOrderId,
      status: "RECOVERED" as const,
      replayed: false,
      recoveredAt,
      actorUserId: input.actorUserId,
      idempotencyKey,
    };
  });

  if (!outcome.replayed) {
    logApplicationEvent({
      level: "INFO",
      event: "DISPATCH_EXHAUSTED_RETRY_RECOVERED",
      message: "Authorized operator recovered exhausted marketplace dispatch order.",
      actorType: "ADMIN",
      actorReference: input.actorUserId,
      resourceReference: outcome.courierOrderId ?? outcome.bridgeId,
      outcome: "SUCCESS",
      context: {
        bridgeId: outcome.bridgeId,
        courierOrderId: outcome.courierOrderId,
        idempotencyKey,
      },
    });
  }

  return outcome;
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

  // Exhausted bridges are terminal for automatic dispatch until an authorized recovery. They are
  // excluded in the database so they cannot occupy batch slots and starve newer orders. A positive
  // JSON-path match plus `id notIn` is used instead of `NOT { json path }`, because SQL three-valued
  // logic would also drop every bridge whose evidence has no `reason` key (including new bridges).
  // The query has no arbitrary ceiling (removes the 5,000-row cap).
  const exhaustedBridges = await prisma.marketplaceStoreOrderDeliveryBridge.findMany({
    where: {
      dispatchEvidence: { path: ["reason"], equals: EXHAUSTED_DISPATCH_REASON },
    },
    select: { id: true },
  });
  const exhaustedBridgeIds = (exhaustedBridges ?? []).map((row) => row.id);

  type CandidateBridgeWithRelations = Awaited<
    ReturnType<typeof prisma.marketplaceStoreOrderDeliveryBridge.findMany<{
      include: {
        storeOrder: { select: { id: true; publicReference: true; derivedStatus: true } };
        courierOrder: { select: { id: true; status: true; deliveryRegionId: true } };
      };
    }>>
  >[number];

  const candidateBridges: CandidateBridgeWithRelations[] =
    await prisma.marketplaceStoreOrderDeliveryBridge.findMany({
      where: {
        ...(exhaustedBridgeIds.length > 0 ? { id: { notIn: exhaustedBridgeIds } } : {}),
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
        // Only the bounded error category/code and safe references are logged. The raw exception
        // message and stack are deliberately excluded: hosting log systems retain console output.
        context: {
          bridgeId: bridge.id,
          courierOrderId,
          consecutiveFailures,
          isExhausted,
          policyReference: authority.policyReference,
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
