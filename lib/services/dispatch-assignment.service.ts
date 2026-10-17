import { AdminActionType, DriverAvailability, DriverStatus, OrderAssignmentEventType, OrderAssignmentStatus, OrderOperationalEventType, OrderStatus, type Prisma, UserRole, UserStatus } from "@/types/db";
import { randomUUID } from "node:crypto";
import { Prisma as PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { canTransitionAssignment } from "@/lib/dispatch/assignment-state-machine";
import { dispatchError } from "@/lib/dispatch/errors";
import { evaluateDriverEligibility } from "@/lib/dispatch/eligibility";
import { withDispatchRetry } from "@/lib/dispatch/retry";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import { projectMarketplaceCourierExecutionInTx } from "@/lib/services/marketplace-courier-order.service";
import { createDispatchCandidateEvaluationInTx, selectDispatchCandidateInTx, setDispatchCandidateDispositionForAssignmentInTx } from "@/lib/services/dispatch-candidate-evidence.service";
import { evaluateDispatchComplianceEvidence } from "@/lib/services/vehicle-compliance.service";
import { DISPATCH_SYSTEM_ACTOR } from "@/lib/dispatch/automation-policy";
export { DISPATCH_SYSTEM_ACTOR };
import type { AdminAssignOrderInput, AdminCancelAssignmentInput, AdminReassignOrderInput, DriverAcceptAssignmentInput, DriverRejectAssignmentInput } from "@/lib/validation/assignment";

export type SystemDispatchOfferAuthority = {
  systemActor: string;
  policyReference: string;
  dispatchOperationId?: string;
};

export type DispatchOfferAuthority = string | SystemDispatchOfferAuthority;

type Tx = Prisma.TransactionClient;
const CURRENT = [OrderAssignmentStatus.ASSIGNED, OrderAssignmentStatus.ACCEPTED];
const CUSTODY: OrderStatus[] = [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERY_ATTEMPTED, OrderStatus.DELIVERED, OrderStatus.COMPLETED];

async function lockOrderAndDrivers(tx: Tx, orderId: string, driverIds: string[]) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  for (const driverId of [...new Set(driverIds)].sort()) await tx.$queryRaw`SELECT id FROM "DriverProfile" WHERE id = ${driverId} FOR NO KEY UPDATE`;
}

async function settings(tx: Tx) {
  const rows = await tx.systemSetting.findMany({ where: { key: { in: ["dispatch.assignment_offer_ttl_minutes", "dispatch.policy_version", "dispatch.default_driver_capacity"] } } });
  const value = (key: string, fallback: string) => typeof rows.find((row) => row.key === key)?.value === "string" ? rows.find((row) => row.key === key)!.value as string : fallback;
  return { ttlMinutes: Math.min(120, Math.max(1, Number.parseInt(value("dispatch.assignment_offer_ttl_minutes", "10"), 10) || 10)), policyVersion: value("dispatch.policy_version", "dispatch-v1"), defaultCapacity: Math.min(10, Math.max(1, Number.parseInt(value("dispatch.default_driver_capacity", "1"), 10) || 1)) };
}

function eventActor(actorUserId: string | null | undefined): EventActor {
  return actorUserId ? { actorUserId } : { actorSystemIdentity: DISPATCH_SYSTEM_ACTOR };
}

async function reconcileExpired(tx: Tx, orderId: string, actorUserId: string | null) {
  const expired = await tx.orderAssignment.findMany({ where: { orderId, status: OrderAssignmentStatus.ASSIGNED, expiresAt: { lte: new Date() } } });
  for (const assignment of expired) {
    const updated = await tx.orderAssignment.updateMany({ where: { id: assignment.id, status: OrderAssignmentStatus.ASSIGNED, version: assignment.version }, data: { status: OrderAssignmentStatus.EXPIRED, activeOrderGuard: null, expiredAt: new Date(), respondedAt: new Date(), version: { increment: 1 } } });
    if (updated.count) await writeEvents(tx, { assignmentId: assignment.id, orderId, driverProfileId: assignment.driverProfileId, ...eventActor(actorUserId), actorRole: "SYSTEM", eventType: OrderAssignmentEventType.ASSIGNMENT_EXPIRED, operationalType: OrderOperationalEventType.ASSIGNMENT_EXPIRED, previousStatus: OrderAssignmentStatus.ASSIGNED, nextStatus: OrderAssignmentStatus.EXPIRED, reasonCode: "OFFER_EXPIRED" });
  }
}

async function validateDriver(tx: Tx, driverProfileId: string, order: { id: string; deliveryRegionId: string | null }, excludeAssignmentId?: string) {
  const [driver, currentCount, config] = await Promise.all([
    tx.driverProfile.findUnique({ where: { id: driverProfileId }, include: { user: true, serviceRegions: true, documents: true, vehicles: { where: { status: "APPROVED", archivedAt: null }, include: { documents: true } } } }),
    tx.orderAssignment.count({ where: { driverProfileId, ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}), status: { in: CURRENT }, OR: [{ status: OrderAssignmentStatus.ACCEPTED }, { status: OrderAssignmentStatus.ASSIGNED, expiresAt: { gt: new Date() } }, { status: OrderAssignmentStatus.ASSIGNED, expiresAt: null }] } }),
    settings(tx),
  ]);
  if (!driver) throw dispatchError.driverIneligible("Driver profile not found.");
  const now = new Date();
  const compliance = evaluateDispatchComplianceEvidence({ driverDocuments: driver.documents, vehicles: driver.vehicles, now });
  const result = evaluateDriverEligibility({ userActive: driver.user.role === UserRole.DRIVER && driver.user.status === UserStatus.ACTIVE, profileActive: driver.status === DriverStatus.ACTIVE, available: driver.availability === DriverAvailability.AVAILABLE, regionMatch: !!order.deliveryRegionId && driver.serviceRegions.some((region) => region.deliveryRegionId === order.deliveryRegionId), activeLoad: currentCount, capacity: driver.maxConcurrentAssignments || config.defaultCapacity, complianceEligible: compliance.eligible });
  if (!result.eligible) {
    if (result.reasons.includes("DRIVER_CAPACITY_REACHED")) throw dispatchError.capacity();
    throw dispatchError.driverIneligible(result.reasons.join(", "));
  }
  return { driver, eligibility: { ...result, policyVersion: config.policyVersion }, config };
}

type EventActor = { actorUserId: string; actorSystemIdentity?: never } | { actorUserId?: null; actorSystemIdentity: string };

async function writeEvents(tx: Tx, input: EventActor & { assignmentId: string; orderId: string; driverProfileId: string; actorRole: string; eventType: OrderAssignmentEventType; operationalType: OrderOperationalEventType; previousStatus: OrderAssignmentStatus | null; nextStatus: OrderAssignmentStatus; reasonCode?: string; note?: string; metadata?: Record<string, unknown> }) {
  const human = typeof input.actorUserId === "string" && input.actorUserId.length > 0;
  if (!human && !input.actorSystemIdentity) throw dispatchError.driverIneligible("A dispatch event requires a human actor or a typed system identity.");
  await tx.orderAssignmentEvent.create({ data: { assignmentId: input.assignmentId, orderId: input.orderId, driverProfileId: input.driverProfileId, actorUserId: human ? input.actorUserId! : null, actorSystemIdentity: human ? null : input.actorSystemIdentity!, actorRole: input.actorRole, eventType: input.eventType, previousStatus: input.previousStatus, newStatus: input.nextStatus, reasonCode: input.reasonCode ?? null, note: input.note ?? null, metadata: ({ policy: "dispatch-v1", ...(input.metadata ?? {}) } as PrismaClient.InputJsonValue) } });
  // The operational timeline requires a real user reference. System-originated events are
  // recorded on the assignment event only, never attributed to an unrelated account.
  if (human) await tx.orderOperationalEvent.create({ data: { orderId: input.orderId, assignmentId: input.assignmentId, driverProfileId: input.driverProfileId, actorUserId: input.actorUserId!, actorRole: input.actorRole, eventType: input.operationalType, publicNote: null, internalNote: input.note ?? null, metadata: { reasonCode: input.reasonCode ?? null, policy: "dispatch-v1" } } });
}

function assertAssignable(order: { status: OrderStatus } | null) {
  if (!order) throw dispatchError.orderNotFound();
  const assignable: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.PICKUP_SCHEDULED];
  if (!assignable.includes(order.status)) throw dispatchError.orderNotAssignable();
}
function assertBeforeCustody(status: OrderStatus) { if (CUSTODY.includes(status)) throw dispatchError.custody(); }

export async function resolveBridgeManualDispatchInTx(
  tx: Tx,
  orderId: string,
  resolution: {
    actorUserId?: string | null;
    actorSystemIdentity?: string | null;
    assignmentId: string;
    driverProfileId: string;
    event: "AUTOMATIC_OFFER_CREATED" | "ADMIN_OFFER_CREATED" | "MANUALLY_ASSIGNED" | "REASSIGNED" | "ACCEPTED";
    dispatchRouting: "AUTOMATIC_OFFER_ACTIVE" | "ASSIGNED";
  }
) {
  if (!tx.marketplaceStoreOrderDeliveryBridge?.findFirst) return;
  const bridge = await tx.marketplaceStoreOrderDeliveryBridge.findFirst({
    where: { courierOrderId: orderId },
    select: { id: true, dispatchEvidence: true },
  });
  if (!bridge) return;

  const existingEvidence = (typeof bridge.dispatchEvidence === "object" && bridge.dispatchEvidence !== null)
    ? bridge.dispatchEvidence as Record<string, unknown>
    : {};

  const historyEntry = {
    event: resolution.event,
    timestamp: new Date().toISOString(),
    actor: resolution.actorUserId ? `ADMIN:${resolution.actorUserId}` : (resolution.actorSystemIdentity ?? DISPATCH_SYSTEM_ACTOR),
    assignmentId: resolution.assignmentId,
    driverProfileId: resolution.driverProfileId,
    previousReason: existingEvidence.reason ?? null,
  };

  await tx.marketplaceStoreOrderDeliveryBridge.update({
    where: { id: bridge.id },
    data: {
      dispatchEvidence: {
        ...existingEvidence,
        manualDispatchRequired: false,
        dispatchRouting: resolution.dispatchRouting,
        manualDispatchResolvedAt: new Date().toISOString(),
        consecutiveFailures: 0,
        history: [
          ...(Array.isArray(existingEvidence.history) ? existingEvidence.history : []),
          historyEntry,
        ],
      },
    },
  });
}

export async function offerAssignment(authority: DispatchOfferAuthority, orderId: string, input: AdminAssignOrderInput) {
  const evaluationOperationId = randomUUID();
  const isSystem = typeof authority === "object" || (typeof authority === "string" && (authority === DISPATCH_SYSTEM_ACTOR || authority.startsWith("SYSTEM:")));
  const systemActor = isSystem
    ? (typeof authority === "object" ? authority.systemActor : authority)
    : null;
  const dispatchPolicyReference = isSystem && typeof authority === "object" ? authority.policyReference : null;
  const dispatchOperationId = isSystem && typeof authority === "object" ? (authority.dispatchOperationId ?? null) : null;
  const adminUserId = isSystem ? null : (authority as string);

  return withDispatchRetry(() => prisma.$transaction(async (tx) => {
    await lockOrderAndDrivers(tx, orderId, [input.driverProfileId]);
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, deliveryRegionId: true } });
    assertAssignable(order);
    await reconcileExpired(tx, orderId, adminUserId);
    const current = await tx.orderAssignment.findFirst({ where: { orderId, activeOrderGuard: orderId } });
    if (current?.driverProfileId === input.driverProfileId && current.status === OrderAssignmentStatus.ASSIGNED) return current;
    if (current) throw dispatchError.assignmentExists();
    const evaluation = await createDispatchCandidateEvaluationInTx(tx, {
      courierOrderId: orderId,
      operationId: evaluationOperationId,
      requestedDriverProfileId: input.driverProfileId,
    });
    // The evidence is a snapshot. Validate again immediately before the
    // assignment write so a stale candidate can never become assignable.
    const { eligibility, config } = await validateDriver(tx, input.driverProfileId, order!);
    const reasonCode = input.reasonCode ?? (isSystem ? "AUTOMATIC_DISPATCH_OFFER" : "INITIAL_ASSIGNMENT");
    const assignment = await (tx as unknown as { orderAssignment: { create(args: unknown): Promise<{ id: string; status: OrderAssignmentStatus; version: number; expiresAt: Date | null }> } }).orderAssignment.create({
      data: {
        orderId,
        driverProfileId: input.driverProfileId,
        assignedByAdminId: adminUserId,
        assignedBySystemActor: systemActor,
        dispatchPolicyReference,
        dispatchOperationId,
        status: OrderAssignmentStatus.ASSIGNED,
        assignedAt: new Date(),
        offeredAt: new Date(),
        expiresAt: new Date(Date.now() + config.ttlMinutes * 60_000),
        activeOrderGuard: orderId,
        dispatchPolicyVersion: config.policyVersion,
        eligibilitySnapshot: eligibility,
        reasonCode,
        adminNote: input.adminNote ?? null,
        dispatchCandidateEvaluationId: evaluation.evaluationId,
      },
    });
    await selectDispatchCandidateInTx(tx, evaluation.evaluationId, input.driverProfileId, assignment.id);
    if (isSystem) {
      await writeEvents(tx, {
        assignmentId: assignment.id,
        orderId,
        driverProfileId: input.driverProfileId,
        actorSystemIdentity: systemActor!,
        actorRole: "SYSTEM",
        eventType: OrderAssignmentEventType.ASSIGNMENT_CREATED,
        operationalType: OrderOperationalEventType.ASSIGNMENT_OFFERED,
        previousStatus: null,
        nextStatus: OrderAssignmentStatus.ASSIGNED,
        reasonCode,
        note: input.adminNote,
        metadata: {
          policyReference: dispatchPolicyReference,
          operationId: dispatchOperationId,
        },
      });
    } else {
      await writeEvents(tx, {
        assignmentId: assignment.id,
        orderId,
        driverProfileId: input.driverProfileId,
        actorUserId: adminUserId!,
        actorRole: "ADMIN",
        eventType: OrderAssignmentEventType.ASSIGNMENT_CREATED,
        operationalType: OrderOperationalEventType.ASSIGNMENT_OFFERED,
        previousStatus: null,
        nextStatus: OrderAssignmentStatus.ASSIGNED,
        reasonCode,
        note: input.adminNote,
      });
      await tx.adminActivityLog.create({
        data: {
          actorUserId: adminUserId!,
          action: AdminActionType.CREATE,
          entityType: "OrderAssignment",
          entityId: assignment.id,
          message: "Dispatch offer created.",
          metadata: { orderId, driverProfileId: input.driverProfileId, reasonCode },
        },
      });
    }
    await resolveBridgeManualDispatchInTx(tx, orderId, {
      actorUserId: adminUserId,
      actorSystemIdentity: systemActor,
      assignmentId: assignment.id,
      driverProfileId: input.driverProfileId,
      event: isSystem ? "AUTOMATIC_OFFER_CREATED" : "ADMIN_OFFER_CREATED",
      dispatchRouting: isSystem ? "AUTOMATIC_OFFER_ACTIVE" : "ASSIGNED",
    });
    return assignment;
  }, { isolationLevel: PrismaClient.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 }));
}

export async function acceptDispatchAssignment(driverProfileId: string, assignmentId: string, input: DriverAcceptAssignmentInput) {
  return withDispatchRetry(() => prisma.$transaction(async (tx) => {
    const minimal = await tx.orderAssignment.findUnique({ where: { id: assignmentId }, select: { orderId: true, driverProfileId: true } });
    if (!minimal || minimal.driverProfileId !== driverProfileId) throw dispatchError.assignmentNotFound();
    await lockOrderAndDrivers(tx, minimal.orderId, [driverProfileId]);
    const assignment = await tx.orderAssignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { order: true, driverProfile: { include: { user: true, serviceRegions: true } } } });
    if (!input.expectedVersion) throw dispatchError.stale();
    if (assignment.status === OrderAssignmentStatus.ACCEPTED && assignment.version > input.expectedVersion) return assignment;
    if (assignment.status !== OrderAssignmentStatus.ASSIGNED) throw dispatchError.resolved();
    if (assignment.version !== input.expectedVersion) throw dispatchError.stale();
    if (assignment.expiresAt && assignment.expiresAt <= new Date()) { await reconcileExpired(tx, assignment.orderId, assignment.driverProfile.userId); throw dispatchError.expired(); }
    assertAssignable(assignment.order);
    await validateDriver(tx, driverProfileId, assignment.order, assignmentId);
    const changed = await tx.orderAssignment.updateMany({ where: { id: assignmentId, status: OrderAssignmentStatus.ASSIGNED, version: input.expectedVersion }, data: { status: OrderAssignmentStatus.ACCEPTED, acceptedAt: new Date(), respondedAt: new Date(), version: { increment: 1 } } });
    if (!changed.count) throw dispatchError.stale();
    await tx.order.update({ where: { id: assignment.orderId }, data: { currentDriverProfileId: driverProfileId } });
    if (assignment.order.status === OrderStatus.CONFIRMED) await transitionOrderStatusInTx(tx, { orderId: assignment.orderId, fromStatus: OrderStatus.CONFIRMED, toStatus: OrderStatus.PICKUP_SCHEDULED, actorUserId: assignment.driverProfile.userId, actorRole: UserRole.DRIVER, source: "dispatch_accept", context: { actorIsAssignedDriver: true, hasAcceptedAssignment: true } });
    await writeEvents(tx, { assignmentId, orderId: assignment.orderId, driverProfileId, actorUserId: assignment.driverProfile.userId, actorRole: "DRIVER", eventType: OrderAssignmentEventType.ASSIGNMENT_ACCEPTED, operationalType: OrderOperationalEventType.ASSIGNMENT_ACCEPTED, previousStatus: OrderAssignmentStatus.ASSIGNED, nextStatus: OrderAssignmentStatus.ACCEPTED });
    await projectMarketplaceCourierExecutionInTx(tx, {
      courierOrderId: assignment.orderId,
      status: "DRIVER_ASSIGNED",
      operationId: `dispatch-accept:${assignmentId}:${input.expectedVersion}`,
      actorUserId: assignment.driverProfile.userId,
    });
    await resolveBridgeManualDispatchInTx(tx, assignment.orderId, {
      actorUserId: assignment.driverProfile.userId,
      assignmentId: assignment.id,
      driverProfileId,
      event: "ACCEPTED",
      dispatchRouting: "ASSIGNED",
    });
    return tx.orderAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
  }, { isolationLevel: PrismaClient.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 }));
}

export async function rejectDispatchAssignment(driverProfileId: string, assignmentId: string, input: DriverRejectAssignmentInput) {
  return withDispatchRetry(() => prisma.$transaction(async (tx) => {
    const minimal = await tx.orderAssignment.findUnique({ where: { id: assignmentId }, select: { orderId: true, driverProfileId: true } });
    if (!minimal || minimal.driverProfileId !== driverProfileId) throw dispatchError.assignmentNotFound();
    await lockOrderAndDrivers(tx, minimal.orderId, [driverProfileId]);
    const assignment = await tx.orderAssignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { driverProfile: { select: { userId: true } } } });
    if (!input.expectedVersion || !input.reasonCode) throw dispatchError.stale();
    if (assignment.status !== OrderAssignmentStatus.ASSIGNED) throw dispatchError.resolved();
    if (assignment.version !== input.expectedVersion) throw dispatchError.stale();
    const changed = await tx.orderAssignment.updateMany({ where: { id: assignmentId, status: OrderAssignmentStatus.ASSIGNED, version: input.expectedVersion }, data: { status: OrderAssignmentStatus.REJECTED, rejectedAt: new Date(), respondedAt: new Date(), activeOrderGuard: null, reasonCode: input.reasonCode, reasonNote: input.note ?? null, rejectionReason: input.reasonCode, version: { increment: 1 } } });
    if (!changed.count) throw dispatchError.stale();
    await writeEvents(tx, { assignmentId, orderId: assignment.orderId, driverProfileId, actorUserId: assignment.driverProfile.userId, actorRole: "DRIVER", eventType: OrderAssignmentEventType.ASSIGNMENT_REJECTED, operationalType: OrderOperationalEventType.ASSIGNMENT_REJECTED, previousStatus: OrderAssignmentStatus.ASSIGNED, nextStatus: OrderAssignmentStatus.REJECTED, reasonCode: input.reasonCode, note: input.note });
    return { ok: true };
  }, { isolationLevel: PrismaClient.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 }));
}

async function closeCurrent(tx: Tx, assignment: { id: string; orderId: string; driverProfileId: string; status: OrderAssignmentStatus; version: number }, target: OrderAssignmentStatus, actorUserId: string, reasonCode: string, note?: string) {
  if (!canTransitionAssignment(assignment.status, target)) throw dispatchError.resolved();
  const changed = await tx.orderAssignment.updateMany({ where: { id: assignment.id, status: assignment.status, version: assignment.version }, data: { status: target, activeOrderGuard: null, version: { increment: 1 }, respondedAt: assignment.status === OrderAssignmentStatus.ASSIGNED ? new Date() : undefined, revokedAt: target === OrderAssignmentStatus.REVOKED ? new Date() : undefined, supersededAt: target === OrderAssignmentStatus.SUPERSEDED ? new Date() : undefined, reasonCode, reasonNote: note ?? null } });
  if (!changed.count) throw dispatchError.stale();
  const eventType = target === OrderAssignmentStatus.SUPERSEDED ? OrderAssignmentEventType.ASSIGNMENT_SUPERSEDED : OrderAssignmentEventType.ASSIGNMENT_REVOKED;
  const operationalType = target === OrderAssignmentStatus.SUPERSEDED ? OrderOperationalEventType.ASSIGNMENT_SUPERSEDED : OrderOperationalEventType.ASSIGNMENT_REVOKED;
  await writeEvents(tx, { assignmentId: assignment.id, orderId: assignment.orderId, driverProfileId: assignment.driverProfileId, actorUserId, actorRole: "ADMIN", eventType, operationalType, previousStatus: assignment.status, nextStatus: target, reasonCode, note });
}

export async function reassignDispatchOrder(adminUserId: string, orderId: string, input: AdminReassignOrderInput) {
  const evaluationOperationId = randomUUID();
  return withDispatchRetry(() => prisma.$transaction(async (tx) => {
    if (!input.currentAssignmentId || !input.expectedVersion || !input.newDriverProfileId || !input.reasonCode) throw dispatchError.stale();
    const current = await tx.orderAssignment.findUnique({ where: { id: input.currentAssignmentId }, select: { orderId: true, driverProfileId: true } });
    if (!current || current.orderId !== orderId) throw dispatchError.assignmentNotFound();
    await lockOrderAndDrivers(tx, orderId, [current.driverProfileId, input.newDriverProfileId]);
    const [order, assignment] = await Promise.all([tx.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, deliveryRegionId: true, currentDriverProfileId: true } }), tx.orderAssignment.findUniqueOrThrow({ where: { id: input.currentAssignmentId } })]);
    assertBeforeCustody(order!.status); assertAssignable(order);
    if (assignment.activeOrderGuard !== orderId || assignment.version !== input.expectedVersion) throw dispatchError.stale();
    if (assignment.driverProfileId === input.newDriverProfileId) throw dispatchError.driverIneligible("A reassignment must use a different driver.");
    const evaluation = await createDispatchCandidateEvaluationInTx(tx, {
      courierOrderId: orderId,
      operationId: evaluationOperationId,
      requestedDriverProfileId: input.newDriverProfileId,
      allowExistingAssignment: true,
      excludeAssignmentId: assignment.id,
    });
    await validateDriver(tx, input.newDriverProfileId, order!, assignment.id);
    await closeCurrent(tx, assignment, OrderAssignmentStatus.SUPERSEDED, adminUserId, input.reasonCode, input.note);
    await setDispatchCandidateDispositionForAssignmentInTx(tx, assignment.id, "SUPERSEDED");
    await tx.order.update({ where: { id: orderId }, data: { currentDriverProfileId: null } });
    const config = await settings(tx);
    const replacement = await (tx as unknown as { orderAssignment: { create(args: unknown): Promise<{ id: string; status: OrderAssignmentStatus; version: number; expiresAt: Date | null }> } }).orderAssignment.create({ data: { orderId, driverProfileId: input.newDriverProfileId, assignedByAdminId: adminUserId, status: OrderAssignmentStatus.ASSIGNED, assignedAt: new Date(), offeredAt: new Date(), expiresAt: new Date(Date.now() + config.ttlMinutes * 60_000), activeOrderGuard: orderId, dispatchPolicyVersion: config.policyVersion, reassignedFromId: assignment.id, reasonCode: input.reasonCode, reasonNote: input.note ?? null, dispatchCandidateEvaluationId: evaluation.evaluationId } });
    await selectDispatchCandidateInTx(tx, evaluation.evaluationId, input.newDriverProfileId, replacement.id);
    await writeEvents(tx, { assignmentId: replacement.id, orderId, driverProfileId: input.newDriverProfileId, actorUserId: adminUserId, actorRole: "ADMIN", eventType: OrderAssignmentEventType.ASSIGNMENT_REASSIGNED, operationalType: OrderOperationalEventType.ASSIGNMENT_OFFERED, previousStatus: null, nextStatus: OrderAssignmentStatus.ASSIGNED, reasonCode: input.reasonCode, note: input.note });
    await tx.adminActivityLog.create({ data: { actorUserId: adminUserId, action: AdminActionType.UPDATE, entityType: "OrderAssignment", entityId: replacement.id, message: "Dispatch assignment reassigned.", metadata: { orderId, previousAssignmentId: assignment.id, reasonCode: input.reasonCode } } });
    return replacement;
  }, { isolationLevel: PrismaClient.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 }));
}

export async function unassignDispatchOrder(adminUserId: string, orderId: string, input: AdminCancelAssignmentInput) {
  return withDispatchRetry(() => prisma.$transaction(async (tx) => {
    if (!input.assignmentId || !input.expectedVersion || !input.reasonCode) throw dispatchError.stale();
    const current = await tx.orderAssignment.findUnique({ where: { id: input.assignmentId }, select: { orderId: true, driverProfileId: true } });
    if (!current || current.orderId !== orderId) throw dispatchError.assignmentNotFound();
    await lockOrderAndDrivers(tx, orderId, [current.driverProfileId]);
    const [order, assignment] = await Promise.all([tx.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, currentDriverProfileId: true } }), tx.orderAssignment.findUniqueOrThrow({ where: { id: input.assignmentId } })]);
    if (!order) throw dispatchError.orderNotFound();
    assertBeforeCustody(order.status);
    if (assignment.activeOrderGuard !== orderId || assignment.version !== input.expectedVersion) throw dispatchError.stale();
    await closeCurrent(tx, assignment, OrderAssignmentStatus.REVOKED, adminUserId, input.reasonCode, input.note);
    await setDispatchCandidateDispositionForAssignmentInTx(tx, assignment.id, "REJECTED");
    await tx.order.update({ where: { id: orderId }, data: { currentDriverProfileId: null } });
    await tx.adminActivityLog.create({ data: { actorUserId: adminUserId, action: AdminActionType.UPDATE, entityType: "OrderAssignment", entityId: assignment.id, message: "Dispatch assignment revoked.", metadata: { orderId, reasonCode: input.reasonCode } } });
    return { ok: true };
  }, { isolationLevel: PrismaClient.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 }));
}

/** Bounded operational command; safe for repeated or concurrent invocation. */
export async function reconcileExpiredDispatchOffers(limit = 100) {
  const candidates = await prisma.orderAssignment.findMany({ where: { status: OrderAssignmentStatus.ASSIGNED, expiresAt: { lte: new Date() } }, select: { id: true, orderId: true, driverProfileId: true, assignedByAdminId: true, assignedBySystemActor: true, version: true }, orderBy: { expiresAt: "asc" }, take: Math.min(500, Math.max(1, limit)) });
  let expired = 0;
  for (const candidate of candidates) {
    await prisma.$transaction(async (tx) => {
      await lockOrderAndDrivers(tx, candidate.orderId, [candidate.driverProfileId]);
      const changed = await tx.orderAssignment.updateMany({ where: { id: candidate.id, status: OrderAssignmentStatus.ASSIGNED, version: candidate.version, expiresAt: { lte: new Date() } }, data: { status: OrderAssignmentStatus.EXPIRED, activeOrderGuard: null, expiredAt: new Date(), respondedAt: new Date(), version: { increment: 1 } } });
      if (changed.count) {
        expired += 1;
        await setDispatchCandidateDispositionForAssignmentInTx(tx, candidate.id, "EXPIRED");
        await writeEvents(tx, {
          assignmentId: candidate.id,
          orderId: candidate.orderId,
          driverProfileId: candidate.driverProfileId,
          actorSystemIdentity: DISPATCH_SYSTEM_ACTOR,
          actorRole: "SYSTEM",
          eventType: OrderAssignmentEventType.ASSIGNMENT_EXPIRED,
          operationalType: OrderOperationalEventType.ASSIGNMENT_EXPIRED,
          previousStatus: OrderAssignmentStatus.ASSIGNED,
          nextStatus: OrderAssignmentStatus.EXPIRED,
          reasonCode: "OFFER_EXPIRED",
        });
      }
    }, { isolationLevel: PrismaClient.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
  }
  return { scanned: candidates.length, expired };
}
