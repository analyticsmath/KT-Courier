import { prisma } from "@/lib/db/prisma";
import {
  OrderAssignmentStatus,
  OrderAssignmentEventType,
  OrderStatus,
  DriverStatus,
  OrderOperationalEventType,
} from "@/types/db";
import type { PrismaClient } from "@prisma/client";
import type { StartPickupInput, CompletePickupInput, FailPickupInput } from "@/lib/validation/pickup";
import { toWorkbenchAssignmentDto, type WorkbenchAssignmentDto } from "@/lib/dto/pickup.dto";
import {
  isPickupEligible,
  isPickupBlocked,
} from "@/lib/constants/pickup";
import { notifyOrderStatusChanged } from "./notification-events.service";
import { OrderTransitionError } from "@/lib/orders/order-state-machine";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import { assertAcceptedCurrentDriver } from "@/lib/driver-operations/authority";
import { completeOperationReceiptInTx, createOperationReceiptInTx, findOperationReplay, getCompletedOperationResult, isOperationReceiptConflict, type DriverOperationSnapshot } from "@/lib/driver-operations/idempotency";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ─── Shared include for workbench queries ─────────────────────────────────────

export const WORKBENCH_ASSIGNMENT_INCLUDE = {
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

// ─── Guard: verify driver owns assignment and is eligible for pickup ───────────

interface PickupEligibilityCheck {
  ok: boolean;
  error?: string;
  assignment?: Awaited<ReturnType<typeof getPickupAssignment>>;
}

async function getPickupAssignment(assignmentId: string, driverProfileId: string) {
  return prisma.orderAssignment.findFirst({
    where: { id: assignmentId, driverProfileId },
    include: {
      ...WORKBENCH_ASSIGNMENT_INCLUDE,
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

export async function assertPickupEligibility(
  assignmentId: string,
  driverProfileId: string
): Promise<PickupEligibilityCheck> {
  const assignment = await getPickupAssignment(assignmentId, driverProfileId);

  if (!assignment) {
    return { ok: false, error: "Assignment not found." };
  }

  if (assignment.driverProfile.status !== DriverStatus.ACTIVE) {
    return {
      ok: false,
      error: `Driver is not active. Current status: ${assignment.driverProfile.status}.`,
    };
  }

  if (assignment.status !== OrderAssignmentStatus.ACCEPTED) {
    return {
      ok: false,
      error: `Assignment must be ACCEPTED to perform pickup actions. Current status: ${assignment.status}.`,
    };
  }

  const orderStatus = assignment.order.status;

  if (isPickupBlocked(orderStatus)) {
    return {
      ok: false,
      error: `Pickup cannot be performed. Order is in status: ${orderStatus}.`,
    };
  }

  if (!isPickupEligible(orderStatus)) {
    return {
      ok: false,
      error: `Order is not in a pickup-eligible status. Current status: ${orderStatus}.`,
    };
  }

  return { ok: true, assignment };
}

// ─── Helper: create operational event in a transaction ────────────────────────

async function createOperationalEventInTx(
  tx: TxClient,
  params: {
    orderId: string;
    assignmentId: string;
    driverProfileId: string;
    actorUserId: string;
    actorRole: string;
    eventType: OrderOperationalEventType;
    statusBefore?: OrderStatus | null;
    statusAfter?: OrderStatus | null;
    publicNote?: string | null;
    internalNote?: string | null;
    failureReason?: import("@/types/db").PickupFailureReason | null;
    parcelCondition?: import("@/types/db").ParcelCondition | null;
    parcelCount?: number | null;
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
      actorRole: params.actorRole,
      eventType: params.eventType,
      statusBefore: params.statusBefore ?? null,
      statusAfter: params.statusAfter ?? null,
      occurredAt: new Date(),
      publicNote: params.publicNote ?? null,
      internalNote: params.internalNote ?? null,
      failureReason: params.failureReason ?? null,
      parcelCondition: params.parcelCondition ?? null,
      parcelCount: params.parcelCount ?? null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
    },
  });
}

// ─── Helper: create assignment event in a transaction ─────────────────────────

async function createAssignmentEventInTx(
  tx: TxClient,
  params: {
    assignmentId: string;
    orderId: string;
    driverProfileId: string;
    actorUserId: string;
    actorRole: string;
    eventType: OrderAssignmentEventType;
    note?: string | null;
  }
) {
  return tx.orderAssignmentEvent.create({
    data: {
      assignmentId: params.assignmentId,
      orderId: params.orderId,
      driverProfileId: params.driverProfileId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      eventType: params.eventType,
      previousStatus: OrderAssignmentStatus.ACCEPTED,
      newStatus: OrderAssignmentStatus.ACCEPTED,
      note: params.note ?? null,
    },
  });
}

// ─── START PICKUP ─────────────────────────────────────────────────────────────
// Rules:
//   - Assignment must be ACCEPTED
//   - Order must be CONFIRMED or PICKUP_SCHEDULED
//   - If CONFIRMED → transition to PICKUP_SCHEDULED
//   - Create operational event PICKUP_STARTED
//   - Create assignment event PICKUP_STARTED
//   - Does not change the driver's future-offer preference

export async function startPickup(
  assignmentId: string,
  driverProfileId: string,
  driverUserId: string,
  input: StartPickupInput
): Promise<{ ok: true; assignment: WorkbenchAssignmentDto; operationResult?: DriverOperationSnapshot } | { ok: false; error: string }> {
  try {
    const replayResult = await findOperationReplay(input.operationId, input);
    if (replayResult) {
      const replay = await prisma.orderAssignment.findFirst({ where: { id: assignmentId, driverProfileId }, include: WORKBENCH_ASSIGNMENT_INCLUDE });
      return replay ? { ok: true, assignment: toWorkbenchAssignmentDto(replay), operationResult: replayResult } : { ok: false, error: "Assignment not found." };
    }
    await assertAcceptedCurrentDriver(assignmentId, driverProfileId, input.assignmentVersion);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Pickup operation was rejected." };
  }
  const check = await assertPickupEligibility(assignmentId, driverProfileId);
  if (!check.ok || !check.assignment) return { ok: false, error: check.error! };

  const assignment = check.assignment;
  const order = assignment.order;
  const statusBefore = order.status;
  let statusAfter: OrderStatus = statusBefore;

  if (statusBefore === OrderStatus.CONFIRMED) statusAfter = OrderStatus.PICKUP_SCHEDULED;

  try {
    await prisma.$transaction(async (tx) => {
      await createOperationReceiptInTx(tx, { operationId: input.operationId, payload: input, orderId: order.id, assignmentId, driverProfileId, type: "PICKUP_START" });
      if (statusAfter !== statusBefore) {
        await transitionOrderStatusInTx(tx, {
          orderId: order.id,
          fromStatus: statusBefore,
          toStatus: statusAfter,
          actorUserId: driverUserId,
          actorRole: "DRIVER",
          note: "Pickup started - driver en route to pickup location.",
          source: "driver_pickup_start",
          context: {
            actorIsAssignedDriver: true,
            hasAcceptedAssignment: true,
          },
        });
      }

      await createOperationalEventInTx(tx, {
        orderId: order.id,
        assignmentId,
        driverProfileId,
        actorUserId: driverUserId,
        actorRole: "DRIVER",
        eventType: OrderOperationalEventType.PICKUP_STARTED,
        statusBefore,
        statusAfter,
        publicNote: "Pickup is in progress.",
        internalNote: input.driverNote ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      });

      await createAssignmentEventInTx(tx, {
        assignmentId,
        orderId: order.id,
        driverProfileId,
        actorUserId: driverUserId,
        actorRole: "DRIVER",
        eventType: OrderAssignmentEventType.PICKUP_STARTED,
        note: input.driverNote ?? null,
      });

      await completeOperationReceiptInTx(tx, input.operationId, {
        type: "PICKUP_START", orderId: order.id, assignmentId, driverProfileId,
        orderStatus: statusAfter, assignmentStatus: OrderAssignmentStatus.ACCEPTED, completedAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    if (isOperationReceiptConflict(error)) {
      const replay = await findOperationReplay(input.operationId, input);
      const current = await prisma.orderAssignment.findFirst({ where: { id: assignmentId, driverProfileId }, include: WORKBENCH_ASSIGNMENT_INCLUDE });
      if (replay && current) return { ok: true, assignment: toWorkbenchAssignmentDto(current), operationResult: replay };
    }
    if (error instanceof OrderTransitionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  const updated = await prisma.orderAssignment.findFirst({
    where: { id: assignmentId },
    include: WORKBENCH_ASSIGNMENT_INCLUDE,
  });

  return { ok: true, assignment: toWorkbenchAssignmentDto(updated!), operationResult: await getCompletedOperationResult(input.operationId) ?? undefined };
}

// ─── COMPLETE PICKUP ──────────────────────────────────────────────────────────
// Rules:
//   - Assignment must be ACCEPTED
//   - Order must be PICKUP_SCHEDULED (or CONFIRMED if pickup was never started explicitly)
//   - Transition order to PICKED_UP
//   - Create OrderStatusHistory
//   - Create operational event PICKUP_COMPLETED
//   - Create assignment event PICKUP_COMPLETED
//   - Driver preference remains unchanged
//   - Send non-blocking status email

export async function completePickup(
  assignmentId: string,
  driverProfileId: string,
  driverUserId: string,
  input: CompletePickupInput
): Promise<{ ok: true; assignment: WorkbenchAssignmentDto; operationResult?: DriverOperationSnapshot } | { ok: false; error: string }> {
  try {
    const replayResult = await findOperationReplay(input.operationId, input);
    if (replayResult) {
      const replay = await prisma.orderAssignment.findFirst({ where: { id: assignmentId, driverProfileId }, include: WORKBENCH_ASSIGNMENT_INCLUDE });
      return replay ? { ok: true, assignment: toWorkbenchAssignmentDto(replay), operationResult: replayResult } : { ok: false, error: "Assignment not found." };
    }
    await assertAcceptedCurrentDriver(assignmentId, driverProfileId, input.assignmentVersion);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Pickup operation was rejected." };
  }
  const check = await assertPickupEligibility(assignmentId, driverProfileId);
  if (!check.ok || !check.assignment) return { ok: false, error: check.error! };

  const assignment = check.assignment;
  const order = assignment.order;
  const statusBefore = order.status;

  // Ensure we can reach PICKED_UP from current status
  // CONFIRMED → PICKUP_SCHEDULED → PICKED_UP; we may need two hops if order is still CONFIRMED
  // Preferred path: if order is CONFIRMED, transition CONFIRMED→PICKUP_SCHEDULED first
  let intermediateStatus: OrderStatus | null = null;
  const targetStatus = OrderStatus.PICKED_UP;
  if (statusBefore === OrderStatus.CONFIRMED) intermediateStatus = OrderStatus.PICKUP_SCHEDULED;

  let recipientEmail: string | null = null;
  let recipientName: string | null = null;
  let orderNumber: string = order.orderNumber;
  let orderSource: string = "CUSTOMER";

  // Fetch customer/store email for notification
  const orderFull = await prisma.order.findUnique({
    where: { id: order.id },
    include: {
      customer: { select: { email: true, name: true } },
      store: { include: { ownerUser: { select: { email: true, name: true } } } },
    },
  });

  if (orderFull) {
    orderNumber = orderFull.orderNumber;
    orderSource = orderFull.source;
    if (orderFull.customer?.email) {
      recipientEmail = orderFull.customer.email;
      recipientName = orderFull.customer.name;
    } else if (orderFull.store?.ownerUser?.email) {
      recipientEmail = orderFull.store.ownerUser.email;
      recipientName = orderFull.store.ownerUser.name;
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await createOperationReceiptInTx(tx, { operationId: input.operationId, payload: input, orderId: order.id, assignmentId, driverProfileId, type: "PICKUP_CONFIRM" });
      if (intermediateStatus) {
        await transitionOrderStatusInTx(tx, {
          orderId: order.id,
          fromStatus: statusBefore,
          toStatus: intermediateStatus,
          actorUserId: driverUserId,
          actorRole: "DRIVER",
          note: "Order moved to pickup scheduled before pickup completion.",
          source: "driver_pickup_complete_intermediate",
          context: {
            actorIsAssignedDriver: true,
            hasAcceptedAssignment: true,
          },
        });
      }

      await transitionOrderStatusInTx(tx, {
        orderId: order.id,
        fromStatus: intermediateStatus ?? statusBefore,
        toStatus: targetStatus,
        actorUserId: driverUserId,
        actorRole: "DRIVER",
        note: input.publicNote ?? "Parcel collected by driver.",
        internalNote: input.driverNote,
        source: "driver_pickup_complete",
        context: {
          actorIsAssignedDriver: true,
          hasAcceptedAssignment: true,
          hasPickupProof: true,
        },
      });

      await tx.order.update({ where: { id: order.id }, data: { custodyEstablishedAt: new Date() } });

      await createOperationalEventInTx(tx, {
        orderId: order.id,
        assignmentId,
        driverProfileId,
        actorUserId: driverUserId,
        actorRole: "DRIVER",
        eventType: OrderOperationalEventType.PICKUP_COMPLETED,
        statusBefore,
        statusAfter: targetStatus,
        publicNote: input.publicNote ?? "Parcel has been collected.",
        internalNote: input.driverNote ?? null,
        parcelCondition: input.parcelCondition,
        parcelCount: input.parcelCount,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      });

      await createAssignmentEventInTx(tx, {
        assignmentId,
        orderId: order.id,
        driverProfileId,
        actorUserId: driverUserId,
        actorRole: "DRIVER",
        eventType: OrderAssignmentEventType.PICKUP_COMPLETED,
        note: input.publicNote ?? null,
      });

      await completeOperationReceiptInTx(tx, input.operationId, {
        type: "PICKUP_CONFIRM", orderId: order.id, assignmentId, driverProfileId,
        orderStatus: targetStatus, assignmentStatus: OrderAssignmentStatus.ACCEPTED, completedAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    if (isOperationReceiptConflict(error)) {
      const replay = await findOperationReplay(input.operationId, input);
      const current = await prisma.orderAssignment.findFirst({ where: { id: assignmentId, driverProfileId }, include: WORKBENCH_ASSIGNMENT_INCLUDE });
      if (replay && current) return { ok: true, assignment: toWorkbenchAssignmentDto(current), operationResult: replay };
    }
    if (error instanceof OrderTransitionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  // Non-blocking status email
  if (recipientEmail) {
    notifyOrderStatusChanged({
      recipientEmail,
      recipientName: recipientName ?? recipientEmail,
      orderNumber,
      newStatus: targetStatus,
      statusNote: input.publicNote ?? "Your parcel has been collected and is in driver custody.",
      orderId: order.id,
      source: orderSource,
    });
  }

  const updated = await prisma.orderAssignment.findFirst({
    where: { id: assignmentId },
    include: WORKBENCH_ASSIGNMENT_INCLUDE,
  });

  return { ok: true, assignment: toWorkbenchAssignmentDto(updated!), operationResult: await getCompletedOperationResult(input.operationId) ?? undefined };
}

// ─── FAIL PICKUP ──────────────────────────────────────────────────────────────
// Rules:
//   - Assignment must be ACCEPTED
//   - Order must be CONFIRMED or PICKUP_SCHEDULED
//   - Do NOT change order status (keep for admin review)
//   - Create operational event PICKUP_FAILED
//   - Create assignment event PICKUP_FAILED
//   - Driver availability: return AVAILABLE only if no other active accepted assignments

export async function failPickup(
  assignmentId: string,
  driverProfileId: string,
  driverUserId: string,
  input: FailPickupInput
): Promise<{ ok: true; assignment: WorkbenchAssignmentDto } | { ok: false; error: string }> {
  const check = await assertPickupEligibility(assignmentId, driverProfileId);
  if (!check.ok || !check.assignment) return { ok: false, error: check.error! };

  const assignment = check.assignment;
  const order = assignment.order;

  await prisma.$transaction(async (tx) => {
    await createOperationalEventInTx(tx, {
      orderId: order.id,
      assignmentId,
      driverProfileId,
      actorUserId: driverUserId,
      actorRole: "DRIVER",
      eventType: OrderOperationalEventType.PICKUP_FAILED,
      statusBefore: order.status,
      statusAfter: null,
      publicNote: "Pickup could not be completed. KT Couriers will review the request.",
      internalNote: input.note,
      failureReason: input.failureReason,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    });

    await createAssignmentEventInTx(tx, {
      assignmentId,
      orderId: order.id,
      driverProfileId,
      actorUserId: driverUserId,
      actorRole: "DRIVER",
      eventType: OrderAssignmentEventType.PICKUP_FAILED,
      note: input.note,
    });
  });

  const updated = await prisma.orderAssignment.findFirst({
    where: { id: assignmentId },
    include: WORKBENCH_ASSIGNMENT_INCLUDE,
  });

  return { ok: true, assignment: toWorkbenchAssignmentDto(updated!) };
}
