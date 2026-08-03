import { prisma } from "@/lib/db/prisma";
import {
  OrderAssignmentStatus,
  OrderAssignmentEventType,
  OrderStatus,
  DriverStatus,
  OrderOperationalEventType,
  ProofOfDeliveryMethod,
  UserRole,
} from "@/types/db";
import type { PrismaClient } from "@prisma/client";
import type { StartDeliveryInput, CompleteDeliveryInput, DeliveryAttemptedInput, DeliveryFailedInput } from "@/lib/validation/delivery";
import { toDeliveryAssignmentDto, type DeliveryAssignmentDto, type DeliveryWorkbenchSummary } from "@/lib/dto/delivery.dto";
import { isDeliveryEligible, isDeliveryAttemptEligible } from "@/lib/constants/delivery";
import { verifyDeliveryOtpInTx } from "./delivery-otp.service";
import { notifyOrderStatusChanged } from "./notification-events.service";
import { recordAdminActivity } from "./admin-activity.service";
import type { AdminManualDeliveryInput } from "@/lib/validation/delivery";
import { OrderTransitionError } from "@/lib/orders/order-state-machine";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import { assertAcceptedCurrentDriver } from "@/lib/driver-operations/authority";
import { completeOperationReceiptInTx, createOperationReceiptInTx, findOperationReplay, getCompletedOperationResult, isOperationReceiptConflict, type DriverOperationSnapshot } from "@/lib/driver-operations/idempotency";
import { isRetryableDeliveryFailure, requiresAttemptEvidence } from "@/lib/driver-operations/delivery-attempt-policy";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ─── Shared include for delivery workbench queries ────────────────────────────

export const DELIVERY_ASSIGNMENT_INCLUDE = {
  order: {
    include: {
      pickupAddress: true,
      dropoffAddress: true,
      deliveryRegion: { select: { name: true } },
    },
  },
  operationalEvents: {
    include: { driverProfile: { select: { driverCode: true, displayName: true } } },
    orderBy: { occurredAt: "asc" as const },
  },
} as const;

// ─── Guard: verify driver owns assignment and is eligible for delivery ────────

interface DeliveryEligibilityCheck {
  ok: boolean;
  error?: string;
  assignment?: Awaited<ReturnType<typeof getDeliveryAssignment>>;
}

async function getDeliveryAssignment(assignmentId: string, driverProfileId: string) {
  return prisma.orderAssignment.findFirst({
    where: { id: assignmentId, driverProfileId },
    include: {
      ...DELIVERY_ASSIGNMENT_INCLUDE,
      driverProfile: {
        select: {
          id: true,
          userId: true,
          status: true,
          availability: true,
          driverCode: true,
          displayName: true,
        },
      },
    },
  });
}

export async function assertDeliveryEligibility(
  assignmentId: string,
  driverProfileId: string,
  options: { allowAttempted?: boolean } = {}
): Promise<DeliveryEligibilityCheck> {
  const assignment = await getDeliveryAssignment(assignmentId, driverProfileId);

  if (!assignment) return { ok: false, error: "Assignment not found." };

  if (assignment.driverProfile.status !== DriverStatus.ACTIVE) {
    return {
      ok: false,
      error: `Driver is not active. Current status: ${assignment.driverProfile.status}.`,
    };
  }

  if (assignment.status !== OrderAssignmentStatus.ACCEPTED) {
    return {
      ok: false,
      error: `Assignment must be ACCEPTED to perform delivery actions. Current status: ${assignment.status}.`,
    };
  }

  const orderStatus = assignment.order.status;
  const eligible = options.allowAttempted
    ? isDeliveryAttemptEligible(orderStatus)
    : isDeliveryEligible(orderStatus);

  if (!eligible) {
    return {
      ok: false,
      error: `Order is not delivery-eligible. Current status: ${orderStatus}. Order must be PICKED_UP or IN_TRANSIT.`,
    };
  }

  return { ok: true, assignment };
}

// ─── Helper: create operational event in a transaction ────────────────────────

async function createOpEvent(
  tx: TxClient,
  params: {
    orderId: string;
    assignmentId: string;
    driverProfileId: string;
    actorUserId: string;
    eventType: OrderOperationalEventType;
    statusBefore?: OrderStatus | null;
    statusAfter?: OrderStatus | null;
    publicNote?: string | null;
    internalNote?: string | null;
    deliveryExceptionReason?: import("@/types/db").DeliveryExceptionReason | null;
    latitude?: number | null;
    longitude?: number | null;
  }
) {
  return tx.orderOperationalEvent.create({
    data: {
      orderId: params.orderId,
      assignmentId: params.assignmentId,
      driverProfileId: params.driverProfileId,
      actorUserId: params.actorUserId,
      actorRole: "DRIVER",
      eventType: params.eventType,
      statusBefore: params.statusBefore ?? null,
      statusAfter: params.statusAfter ?? null,
      occurredAt: new Date(),
      publicNote: params.publicNote ?? null,
      internalNote: params.internalNote ?? null,
      deliveryExceptionReason: params.deliveryExceptionReason ?? null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
    },
  });
}

// ─── Helper: create assignment event ─────────────────────────────────────────

async function createAssignEvent(
  tx: TxClient,
  params: {
    assignmentId: string;
    orderId: string;
    driverProfileId: string;
    actorUserId: string;
    eventType: OrderAssignmentEventType;
    previousStatus: OrderAssignmentStatus;
    newStatus: OrderAssignmentStatus;
    note?: string | null;
  }
) {
  return tx.orderAssignmentEvent.create({
    data: {
      assignmentId: params.assignmentId,
      orderId: params.orderId,
      driverProfileId: params.driverProfileId,
      actorUserId: params.actorUserId,
      actorRole: "DRIVER",
      eventType: params.eventType,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      note: params.note ?? null,
    },
  });
}

// ─── Helper: fetch order email recipients ────────────────────────────────────

async function getOrderRecipientInfo(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { email: true, name: true } },
      store: { include: { ownerUser: { select: { email: true, name: true } } } },
    },
  });
  if (!order) return null;

  let recipientEmail: string | null = null;
  let recipientName: string | null = null;

  if (order.customer?.email) {
    recipientEmail = order.customer.email;
    recipientName = order.customer.name;
  } else if (order.store?.ownerUser?.email) {
    recipientEmail = order.store.ownerUser.email;
    recipientName = order.store.ownerUser.name;
  }

  return {
    recipientEmail,
    recipientName,
    orderNumber: order.orderNumber,
    source: order.source,
  };
}

// ─── START DELIVERY ───────────────────────────────────────────────────────────
// PICKED_UP → IN_TRANSIT
// Creates DELIVERY_STARTED operational event.
// Assignment remains ACCEPTED.
// Driver preference remains unchanged.

export async function startDelivery(
  assignmentId: string,
  driverProfileId: string,
  driverUserId: string,
  input: StartDeliveryInput,
  operationType: "TRANSIT_START" | "DELIVERY_RESUME" = "TRANSIT_START"
): Promise<{ ok: true; assignment: DeliveryAssignmentDto; operationResult?: DriverOperationSnapshot } | { ok: false; error: string }> {
  try {
    const replayResult = await findOperationReplay(input.operationId, input);
    if (replayResult) {
      const replay = await prisma.orderAssignment.findFirst({ where: { id: assignmentId, driverProfileId }, include: DELIVERY_ASSIGNMENT_INCLUDE });
      return replay ? { ok: true, assignment: toDeliveryAssignmentDto(replay), operationResult: replayResult } : { ok: false, error: "Assignment not found." };
    }
    await assertAcceptedCurrentDriver(assignmentId, driverProfileId, input.assignmentVersion);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Transit operation was rejected." };
  }
  const check = await assertDeliveryEligibility(assignmentId, driverProfileId, {
    allowAttempted: true,
  });
  if (!check.ok || !check.assignment) return { ok: false, error: check.error! };

  const assignment = check.assignment;
  const order = assignment.order;
  const statusBefore = order.status;
  let statusAfter = statusBefore;

  if (
    statusBefore === OrderStatus.PICKED_UP ||
    statusBefore === OrderStatus.DELIVERY_ATTEMPTED
  ) {
    statusAfter = OrderStatus.IN_TRANSIT;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await createOperationReceiptInTx(tx, { operationId: input.operationId, payload: input, orderId: order.id, assignmentId, driverProfileId, type: operationType });
      if (statusAfter !== statusBefore) {
        await transitionOrderStatusInTx(tx, {
          orderId: order.id,
          fromStatus: statusBefore,
          toStatus: statusAfter,
          actorUserId: driverUserId,
          actorRole: "DRIVER",
          note: "Driver has started delivery.",
          internalNote: input.driverNote,
          source: "driver_delivery_start",
          context: {
            actorIsAssignedDriver: true,
            hasAcceptedAssignment: true,
          },
        });
      }

      await tx.order.update({ where: { id: order.id }, data: { transitStartedAt: new Date() } });

      await createOpEvent(tx, {
        orderId: order.id,
        assignmentId,
        driverProfileId,
        actorUserId: driverUserId,
        eventType: OrderOperationalEventType.DELIVERY_STARTED,
        statusBefore,
        statusAfter,
        publicNote: "Your delivery is on its way.",
        internalNote: input.driverNote ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      });

      await createAssignEvent(tx, {
        assignmentId,
        orderId: order.id,
        driverProfileId,
        actorUserId: driverUserId,
        eventType: OrderAssignmentEventType.DELIVERY_STARTED,
        previousStatus: OrderAssignmentStatus.ACCEPTED,
        newStatus: OrderAssignmentStatus.ACCEPTED,
      });

      await completeOperationReceiptInTx(tx, input.operationId, {
        type: operationType, orderId: order.id, assignmentId, driverProfileId,
        orderStatus: statusAfter, assignmentStatus: OrderAssignmentStatus.ACCEPTED, completedAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    if (isOperationReceiptConflict(error)) {
      const replay = await findOperationReplay(input.operationId, input);
      const current = await prisma.orderAssignment.findFirst({ where: { id: assignmentId, driverProfileId }, include: DELIVERY_ASSIGNMENT_INCLUDE });
      if (replay && current) return { ok: true, assignment: toDeliveryAssignmentDto(current), operationResult: replay };
    }
    if (error instanceof OrderTransitionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  const updated = await prisma.orderAssignment.findFirst({
    where: { id: assignmentId },
    include: DELIVERY_ASSIGNMENT_INCLUDE,
  });
  return { ok: true, assignment: toDeliveryAssignmentDto(updated!), operationResult: await getCompletedOperationResult(input.operationId) ?? undefined };
}

/** A retry is not an unrestricted start: it must follow the current driver's
 * latest retryable attempt and an already-established custody boundary. */
export async function resumeDelivery(
  assignmentId: string,
  driverProfileId: string,
  driverUserId: string,
  input: StartDeliveryInput
): Promise<{ ok: true; assignment: DeliveryAssignmentDto; operationResult?: DriverOperationSnapshot } | { ok: false; error: string }> {
  const authority = await assertAcceptedCurrentDriver(assignmentId, driverProfileId, input.assignmentVersion).catch(() => null);
  if (!authority) return { ok: false, error: "Only the current accepted driver can resume delivery." };
  if (authority.orderStatus !== OrderStatus.DELIVERY_ATTEMPTED) return { ok: false, error: "Delivery can only be resumed after a recorded attempt." };
  const order = await prisma.order.findUniqueOrThrow({ where: { id: authority.orderId }, select: { custodyEstablishedAt: true } });
  const latest = await prisma.deliveryAttempt.findFirst({ where: { orderId: authority.orderId }, orderBy: { attemptNumber: "desc" } });
  if (!order.custodyEstablishedAt || !latest || latest.assignmentId !== assignmentId || !latest.retryable) {
    return { ok: false, error: "The latest delivery attempt is not eligible for retry." };
  }
  return startDelivery(assignmentId, driverProfileId, driverUserId, input, "DELIVERY_RESUME");
}

// ─── COMPLETE DELIVERY (OTP) ──────────────────────────────────────────────────
// Verifies OTP → Creates ProofOfDelivery → DELIVERED → Completes assignment.

export async function completeDelivery(
  assignmentId: string,
  driverProfileId: string,
  driverUserId: string,
  input: CompleteDeliveryInput
): Promise<{ ok: true; assignment: DeliveryAssignmentDto; operationResult?: DriverOperationSnapshot } | { ok: false; error: string }> {
  try {
    const replayResult = await findOperationReplay(input.operationId, input);
    if (replayResult) {
      const replay = await prisma.orderAssignment.findFirst({ where: { id: assignmentId, driverProfileId }, include: DELIVERY_ASSIGNMENT_INCLUDE });
      return replay ? { ok: true, assignment: toDeliveryAssignmentDto(replay), operationResult: replayResult } : { ok: false, error: "Assignment not found." };
    }
    await assertAcceptedCurrentDriver(assignmentId, driverProfileId, input.assignmentVersion);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Delivery operation was rejected." };
  }
  const check = await assertDeliveryEligibility(assignmentId, driverProfileId, {
    allowAttempted: true,
  });
  if (!check.ok || !check.assignment) return { ok: false, error: check.error! };

  const assignment = check.assignment;
  const order = assignment.order;

  const statusBefore = order.status;
  const statusAfter = OrderStatus.DELIVERED;

  const deliveredAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await createOperationReceiptInTx(tx, { operationId: input.operationId, payload: input, orderId: order.id, assignmentId, driverProfileId, type: "DELIVERY_COMPLETE" });
      const otpResult = await verifyDeliveryOtpInTx(tx, order.id, input.otpCode);
      if (!otpResult.ok) {
        throw new OrderTransitionError(otpResult.error ?? "OTP verification failed.", "INVALID_TRANSITION");
      }
      // Create ProofOfDelivery
      const pod = await tx.proofOfDelivery.create({
        data: {
          orderId: order.id,
          assignmentId,
          driverProfileId,
          method: ProofOfDeliveryMethod.OTP,
          recipientName: input.recipientName,
          recipientPhone: input.recipientPhone ?? null,
          otpVerifiedAt: deliveredAt,
          deliveredAt,
          publicNote: input.publicNote ?? null,
          internalNote: input.driverNote ?? null,
          evidenceReference: input.evidenceReference ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          createdByUserId: driverUserId,
          createdByRole: "DRIVER",
        },
      });

      await transitionOrderStatusInTx(tx, {
        orderId: order.id,
        fromStatus: statusBefore,
        toStatus: statusAfter,
        actorUserId: driverUserId,
        actorRole: "DRIVER",
        note: input.publicNote ?? `Delivered to ${input.recipientName}.`,
        internalNote: input.driverNote,
        source: "driver_delivery_complete",
        context: {
          actorIsAssignedDriver: true,
          hasAcceptedAssignment: true,
          hasValidDeliveryOtp: true,
          hasDeliveryProof: true,
        },
      });

      // Operational events
      await createOpEvent(tx, {
        orderId: order.id,
        assignmentId,
        driverProfileId,
        actorUserId: driverUserId,
        eventType: OrderOperationalEventType.DELIVERY_OTP_VERIFIED,
        statusBefore,
        statusAfter,
        publicNote: null,
        internalNote: `OTP verified for ${input.recipientName}`,
      });

      await createOpEvent(tx, {
        orderId: order.id,
        assignmentId,
        driverProfileId,
        actorUserId: driverUserId,
        eventType: OrderOperationalEventType.DELIVERY_COMPLETED,
        statusBefore,
        statusAfter,
        publicNote: input.publicNote ?? `Your parcel has been delivered to ${input.recipientName}.`,
        internalNote: input.driverNote ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      });

      await createOpEvent(tx, {
        orderId: order.id,
        assignmentId,
        driverProfileId,
        actorUserId: driverUserId,
        eventType: OrderOperationalEventType.POD_CREATED,
        statusBefore,
        statusAfter,
        publicNote: null,
        internalNote: null,
      });

      // Complete the assignment
      await tx.orderAssignment.update({
        where: { id: assignmentId },
        data: {
          status: OrderAssignmentStatus.COMPLETED,
          completedAt: deliveredAt,
          activeOrderGuard: null,
          version: { increment: 1 },
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { currentDriverProfileId: null },
      });

      await createAssignEvent(tx, {
        assignmentId,
        orderId: order.id,
        driverProfileId,
        actorUserId: driverUserId,
        eventType: OrderAssignmentEventType.DELIVERY_COMPLETED,
        previousStatus: OrderAssignmentStatus.ACCEPTED,
        newStatus: OrderAssignmentStatus.COMPLETED,
        note: `Delivered to ${input.recipientName}`,
      });
      await completeOperationReceiptInTx(tx, input.operationId, {
        type: "DELIVERY_COMPLETE", orderId: order.id, assignmentId, driverProfileId,
        orderStatus: statusAfter, assignmentStatus: OrderAssignmentStatus.COMPLETED,
        createdPodId: pod.id, completedAt: deliveredAt.toISOString(),
      });

      await createAssignEvent(tx, {
        assignmentId,
        orderId: order.id,
        driverProfileId,
        actorUserId: driverUserId,
        eventType: OrderAssignmentEventType.ASSIGNMENT_COMPLETED,
        previousStatus: OrderAssignmentStatus.ACCEPTED,
        newStatus: OrderAssignmentStatus.COMPLETED,
      });
    });
  } catch (error) {
    if (isOperationReceiptConflict(error)) {
      const replay = await findOperationReplay(input.operationId, input);
      const current = await prisma.orderAssignment.findFirst({ where: { id: assignmentId, driverProfileId }, include: DELIVERY_ASSIGNMENT_INCLUDE });
      if (replay && current) return { ok: true, assignment: toDeliveryAssignmentDto(current), operationResult: replay };
    }
    if (error instanceof OrderTransitionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  // Non-blocking status email
  const info = await getOrderRecipientInfo(order.id);
  if (info?.recipientEmail) {
    notifyOrderStatusChanged({
      recipientEmail: info.recipientEmail,
      recipientName: info.recipientName ?? info.recipientEmail,
      orderNumber: info.orderNumber,
      newStatus: statusAfter,
      statusNote: input.publicNote ?? `Your parcel has been delivered to ${input.recipientName}.`,
      orderId: order.id,
      source: info.source,
    });
  }

  const updated = await prisma.orderAssignment.findFirst({
    where: { id: assignmentId },
    include: DELIVERY_ASSIGNMENT_INCLUDE,
  });
  return { ok: true, assignment: toDeliveryAssignmentDto(updated!), operationResult: await getCompletedOperationResult(input.operationId) ?? undefined };
}

// ─── DELIVERY ATTEMPTED ───────────────────────────────────────────────────────
// Records a failed attempt without creating POD. Order → DELIVERY_ATTEMPTED.
// Assignment stays ACCEPTED. Driver preference remains unchanged.

export async function recordDeliveryAttempted(
  assignmentId: string,
  driverProfileId: string,
  driverUserId: string,
  input: DeliveryAttemptedInput
): Promise<{ ok: true; assignment: DeliveryAssignmentDto; operationResult?: DriverOperationSnapshot } | { ok: false; error: string }> {
  try {
    const replayResult = await findOperationReplay(input.operationId, input);
    if (replayResult) {
      const replay = await prisma.orderAssignment.findFirst({ where: { id: assignmentId, driverProfileId }, include: DELIVERY_ASSIGNMENT_INCLUDE });
      return replay ? { ok: true, assignment: toDeliveryAssignmentDto(replay), operationResult: replayResult } : { ok: false, error: "Assignment not found." };
    }
    await assertAcceptedCurrentDriver(assignmentId, driverProfileId, input.assignmentVersion);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Delivery attempt was rejected." };
  }
  const assignment = await getDeliveryAssignment(assignmentId, driverProfileId);
  if (!assignment) return { ok: false, error: "Assignment not found." };

  if (assignment.driverProfile.status !== DriverStatus.ACTIVE) {
    return { ok: false, error: `Driver is not active. Current status: ${assignment.driverProfile.status}.` };
  }

  if (assignment.status !== OrderAssignmentStatus.ACCEPTED) {
    return { ok: false, error: `Assignment must be ACCEPTED. Current status: ${assignment.status}.` };
  }

  if (!isDeliveryAttemptEligible(assignment.order.status)) {
    return {
      ok: false,
      error: `Cannot record delivery attempt from order status: ${assignment.order.status}.`,
    };
  }

  if (requiresAttemptEvidence(input.reason) && !input.evidenceReference) {
    return { ok: false, error: "Evidence is required for this delivery-attempt reason." };
  }

  const order = assignment.order;
  const statusBefore = order.status;
  const statusAfter = OrderStatus.DELIVERY_ATTEMPTED;

  try {
    await prisma.$transaction(async (tx) => {
      await createOperationReceiptInTx(tx, { operationId: input.operationId, payload: input, orderId: order.id, assignmentId, driverProfileId, type: "DELIVERY_ATTEMPT" });
      // Serialize attempt-number allocation per order. The unique constraint is a backstop.
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
      if (statusBefore !== OrderStatus.DELIVERY_ATTEMPTED) {
        await transitionOrderStatusInTx(tx, {
          orderId: order.id,
          fromStatus: statusBefore,
          toStatus: statusAfter,
          actorUserId: driverUserId,
          actorRole: "DRIVER",
          note: input.publicNote ?? "Delivery was attempted but could not be completed.",
          internalNote: input.driverNote,
          source: "driver_delivery_attempt",
          context: {
            actorIsAssignedDriver: true,
            hasAcceptedAssignment: true,
          },
        });
      }

      await createOpEvent(tx, {
        orderId: order.id,
        assignmentId,
        driverProfileId,
        actorUserId: driverUserId,
        eventType: OrderOperationalEventType.DELIVERY_ATTEMPTED,
        statusBefore,
        statusAfter: statusBefore !== OrderStatus.DELIVERY_ATTEMPTED ? statusAfter : statusBefore,
        publicNote: input.publicNote ?? "Delivery was attempted but could not be completed. KT Couriers will be in touch.",
        internalNote: input.driverNote,
        deliveryExceptionReason: input.reason,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      });

      const lastAttempt = await tx.deliveryAttempt.aggregate({ where: { orderId: order.id }, _max: { attemptNumber: true } });
      const attempt = await tx.deliveryAttempt.create({
        data: {
          orderId: order.id,
          assignmentId,
          driverProfileId,
          attemptNumber: (lastAttempt._max.attemptNumber ?? 0) + 1,
          reason: input.reason,
          retryable: isRetryableDeliveryFailure(input.reason),
          publicNote: input.publicNote ?? null,
          internalNote: input.driverNote,
          evidenceReference: input.evidenceReference ?? null,
        },
      });

      await createAssignEvent(tx, {
        assignmentId,
        orderId: order.id,
        driverProfileId,
        actorUserId: driverUserId,
        eventType: OrderAssignmentEventType.DELIVERY_ATTEMPTED,
        previousStatus: OrderAssignmentStatus.ACCEPTED,
        newStatus: OrderAssignmentStatus.ACCEPTED,
        note: input.driverNote,
      });
      await completeOperationReceiptInTx(tx, input.operationId, {
        type: "DELIVERY_ATTEMPT", orderId: order.id, assignmentId, driverProfileId,
        orderStatus: statusAfter, assignmentStatus: OrderAssignmentStatus.ACCEPTED,
        createdAttemptId: attempt.id, completedAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    if (isOperationReceiptConflict(error)) {
      const replay = await findOperationReplay(input.operationId, input);
      const current = await prisma.orderAssignment.findFirst({ where: { id: assignmentId, driverProfileId }, include: DELIVERY_ASSIGNMENT_INCLUDE });
      if (replay && current) return { ok: true, assignment: toDeliveryAssignmentDto(current), operationResult: replay };
    }
    if (error instanceof OrderTransitionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  const updated = await prisma.orderAssignment.findFirst({
    where: { id: assignmentId },
    include: DELIVERY_ASSIGNMENT_INCLUDE,
  });
  return { ok: true, assignment: toDeliveryAssignmentDto(updated!), operationResult: await getCompletedOperationResult(input.operationId) ?? undefined };
}

// ─── DELIVERY FAILED (hard failure) ──────────────────────────────────────────
// Records hard failure. Order → FAILED. Assignment stays ACCEPTED.
// Driver availability: AVAILABLE if no other active work.

export async function recordDeliveryFailed(
  assignmentId: string,
  driverProfileId: string,
  driverUserId: string,
  input: DeliveryFailedInput
): Promise<{ ok: true; assignment: DeliveryAssignmentDto } | { ok: false; error: string }> {
  // Terminal failure is an audited administrative decision in Phase 8. Drivers
  // record attempts only; they cannot unilaterally terminally fail an order.
  if (driverUserId) return { ok: false, error: "Drivers cannot mark a delivery as terminally failed. Record a delivery attempt for review." };
  const assignment = await getDeliveryAssignment(assignmentId, driverProfileId);
  if (!assignment) return { ok: false, error: "Assignment not found." };

  if (assignment.driverProfile.status !== DriverStatus.ACTIVE) {
    return { ok: false, error: "Driver is not active." };
  }

  if (assignment.status !== OrderAssignmentStatus.ACCEPTED) {
    return { ok: false, error: "Assignment must be ACCEPTED." };
  }

  const order = assignment.order;
  const statusBefore = order.status;

  if (!isDeliveryAttemptEligible(statusBefore)) {
    return { ok: false, error: `Cannot record delivery failure from status: ${statusBefore}.` };
  }

  const statusAfter = OrderStatus.FAILED;
  try {
    await prisma.$transaction(async (tx) => {
      await transitionOrderStatusInTx(tx, {
        orderId: order.id,
        fromStatus: statusBefore,
        toStatus: statusAfter,
        actorUserId: driverUserId,
        actorRole: "DRIVER",
        reason: input.note,
        note: "Delivery could not be completed.",
        internalNote: input.note,
        source: "driver_delivery_failed",
        context: {
          actorIsAssignedDriver: true,
          hasAcceptedAssignment: true,
          reason: input.note,
        },
      });

      await createOpEvent(tx, {
        orderId: order.id,
        assignmentId,
        driverProfileId,
        actorUserId: driverUserId,
        eventType: OrderOperationalEventType.DELIVERY_FAILED,
        statusBefore,
        statusAfter,
        publicNote: "Delivery could not be completed. KT Couriers will review and contact you.",
        internalNote: input.note,
        deliveryExceptionReason: input.reason,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      });

      await createAssignEvent(tx, {
        assignmentId,
        orderId: order.id,
        driverProfileId,
        actorUserId: driverUserId,
        eventType: OrderAssignmentEventType.DELIVERY_FAILED,
        previousStatus: OrderAssignmentStatus.ACCEPTED,
        newStatus: OrderAssignmentStatus.ACCEPTED,
        note: input.note,
      });
    });
  } catch (error) {
    if (error instanceof OrderTransitionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  const updated = await prisma.orderAssignment.findFirst({
    where: { id: assignmentId },
    include: DELIVERY_ASSIGNMENT_INCLUDE,
  });
  return { ok: true, assignment: toDeliveryAssignmentDto(updated!) };
}

// ─── ADMIN MANUAL DELIVERY OVERRIDE ──────────────────────────────────────────
// Admin can confirm delivery manually when OTP failed or driver is unavailable.
// Always creates AdminActivityLog. Always records ADMIN_DELIVERY_OVERRIDE event.

export async function adminManualDeliveryComplete(
  orderId: string,
  adminUserId: string,
  adminRole: UserRole,
  input: AdminManualDeliveryInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (adminRole !== UserRole.ADMIN && adminRole !== UserRole.SUPER_ADMIN) {
    return { ok: false, error: "Admin access is required for manual delivery override." };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      assignments: {
        where: { status: OrderAssignmentStatus.ACCEPTED },
        include: { driverProfile: { select: { id: true, driverCode: true } } },
      },
    },
  });

  if (!order) return { ok: false, error: "Order not found." };

  if (order.status === OrderStatus.DELIVERED) {
    return { ok: false, error: "Order is already delivered." };
  }

  if (!isDeliveryAttemptEligible(order.status)) {
    return { ok: false, error: `Cannot manually complete delivery from status: ${order.status}.` };
  }

  const statusBefore = order.status;
  const statusAfter = OrderStatus.DELIVERED;

  const deliveredAt = input.deliveredAt ? new Date(input.deliveredAt) : new Date();
  const activeAssignment = order.assignments[0] ?? null;
  const driverProfileId = activeAssignment?.driverProfile?.id ?? null;
  const assignmentId = activeAssignment?.id ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.proofOfDelivery.create({
        data: {
          orderId,
          assignmentId,
          driverProfileId,
          method: ProofOfDeliveryMethod.ADMIN_MANUAL,
          recipientName: input.recipientName,
          recipientPhone: input.recipientPhone ?? null,
          otpVerifiedAt: null,
          deliveredAt,
          publicNote: input.publicNote ?? null,
          internalNote: `Manual override by admin. Reason: ${input.reason}`,
          createdByUserId: adminUserId,
          createdByRole: adminRole,
        },
      });

      await transitionOrderStatusInTx(tx, {
        orderId,
        fromStatus: statusBefore,
        toStatus: statusAfter,
        actorUserId: adminUserId,
        actorRole: adminRole,
        reason: input.reason,
        note: input.publicNote ?? "Delivery confirmed by KT Couriers.",
        internalNote: `Admin manual delivery. Reason: ${input.reason}`,
        source: "admin_manual_delivery_complete",
        context: {
          allowAdminOverride: true,
          hasDeliveryProof: true,
          reason: input.reason,
        },
      });

      await tx.orderOperationalEvent.create({
        data: {
          orderId,
          assignmentId,
          driverProfileId,
          actorUserId: adminUserId,
          actorRole: adminRole,
          eventType: OrderOperationalEventType.ADMIN_DELIVERY_OVERRIDE,
          statusBefore,
          statusAfter,
          occurredAt: deliveredAt,
          publicNote: input.publicNote ?? "Delivery has been confirmed by KT Couriers.",
          internalNote: `Manual override. Reason: ${input.reason}`,
        },
      });

      // Complete the assignment if it exists
      if (activeAssignment) {
        await tx.orderAssignment.update({
          where: { id: activeAssignment.id },
        data: { status: OrderAssignmentStatus.COMPLETED, completedAt: deliveredAt, activeOrderGuard: null, version: { increment: 1 } },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { currentDriverProfileId: null },
        });
      }
    });
  } catch (error) {
    if (error instanceof OrderTransitionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  await recordAdminActivity({
    actorUserId: adminUserId,
    action: "STATUS_CHANGE",
    entityType: "Order",
    entityId: orderId,
    message: `Manually confirmed delivery for order ${order.orderNumber}.`,
    metadata: { reason: input.reason, recipientName: input.recipientName },
  });

  const info = await getOrderRecipientInfo(orderId);
  if (info?.recipientEmail) {
    notifyOrderStatusChanged({
      recipientEmail: info.recipientEmail,
      recipientName: info.recipientName ?? info.recipientEmail,
      orderNumber: info.orderNumber,
      newStatus: statusAfter,
      statusNote: input.publicNote ?? "Your delivery has been confirmed by KT Couriers.",
      orderId,
      source: info.source,
    });
  }

  return { ok: true };
}

// ─── Get delivery-ready assignments for a driver ──────────────────────────────

export async function getDeliveryAssignments(
  driverProfileId: string
): Promise<DeliveryAssignmentDto[]> {
  const assignments = await prisma.orderAssignment.findMany({
    where: {
      driverProfileId,
      status: OrderAssignmentStatus.ACCEPTED,
      order: {
        status: { in: [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERY_ATTEMPTED] },
      },
    },
    include: DELIVERY_ASSIGNMENT_INCLUDE,
    orderBy: { acceptedAt: "asc" },
  });

  return assignments.map(toDeliveryAssignmentDto);
}

// ─── Get a single delivery assignment (driver-owned) ─────────────────────────

export async function getDeliveryAssignmentForDriver(
  assignmentId: string,
  driverProfileId: string
): Promise<DeliveryAssignmentDto | null> {
  const assignment = await prisma.orderAssignment.findFirst({
    where: { id: assignmentId, driverProfileId },
    include: DELIVERY_ASSIGNMENT_INCLUDE,
  });
  return assignment ? toDeliveryAssignmentDto(assignment) : null;
}

// ─── Get driver delivery workbench summary ────────────────────────────────────

export async function getDeliveryWorkbenchSummary(
  driverProfileId: string
): Promise<DeliveryWorkbenchSummary> {
  const accepted = await prisma.orderAssignment.findMany({
    where: {
      driverProfileId,
      status: OrderAssignmentStatus.ACCEPTED,
    },
    include: { order: { select: { status: true } } },
  });

  let deliveryReadyCount = 0;
  let inTransitCount = 0;
  let deliveryAttemptedCount = 0;

  for (const a of accepted) {
    if (a.order.status === OrderStatus.PICKED_UP) deliveryReadyCount++;
    else if (a.order.status === OrderStatus.IN_TRANSIT) inTransitCount++;
    else if (a.order.status === OrderStatus.DELIVERY_ATTEMPTED) deliveryAttemptedCount++;
  }

  return { deliveryReadyCount, inTransitCount, deliveryAttemptedCount };
}
