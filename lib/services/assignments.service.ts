import { prisma } from "@/lib/db/prisma";
import { OrderAssignmentStatus, OrderAssignmentEventType, DriverStatus } from "@/types/db";
import type { PrismaClient } from "@prisma/client";
import {
  isActiveAssignment,
  isOrderAssignable,
  isValidAssignmentTransition,
  ACTIVE_ASSIGNMENT_STATUSES,
} from "@/lib/constants/assignments";

// ─── Shared include shapes ────────────────────────────────────────────────────

export const ASSIGNMENT_ORDER_INCLUDE = {
  pickupAddress: true,
  dropoffAddress: true,
  deliveryRegion: { select: { name: true } },
} as const;

export const ASSIGNMENT_DRIVER_INCLUDE = {
  user: true,
  serviceRegions: { include: { deliveryRegion: true } },
} as const;

export const ASSIGNMENT_FULL_INCLUDE = {
  order: { include: ASSIGNMENT_ORDER_INCLUDE },
  driverProfile: { include: ASSIGNMENT_DRIVER_INCLUDE },
  events: { orderBy: { createdAt: "asc" as const } },
} as const;

// ─── Guard: find an active assignment for an order ────────────────────────────

export async function findActiveAssignment(orderId: string) {
  return prisma.orderAssignment.findFirst({
    where: {
      orderId,
      status: { in: ACTIVE_ASSIGNMENT_STATUSES },
    },
    include: ASSIGNMENT_FULL_INCLUDE,
  });
}

// ─── Guard: verify order is assignable ───────────────────────────────────────

interface AssignableOrder {
  id: string;
  orderNumber: string;
  status: import("@prisma/client").OrderStatus;
  deliveryRegionId: string | null;
}

export async function assertOrderAssignable(orderId: string): Promise<
  { ok: true; order: AssignableOrder } | { ok: false; error: string }
> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      deliveryRegionId: true,
    },
  });

  if (!order) return { ok: false, error: "Order not found." };
  if (!isOrderAssignable(order.status)) {
    return {
      ok: false,
      error: `Order cannot be assigned in its current status: ${order.status}. Only CONFIRMED and PICKUP_SCHEDULED orders can be assigned.`,
    };
  }

  return { ok: true, order };
}

// ─── Guard: verify driver is eligible for assignment ─────────────────────────

export async function assertDriverEligible(
  driverProfileId: string,
  allowUnavailable = false
): Promise<{ ok: true } | { ok: false; error: string; warn?: string }> {
  const driver = await prisma.driverProfile.findUnique({
    where: { id: driverProfileId },
    select: { id: true, status: true, availability: true, driverCode: true },
  });

  if (!driver) return { ok: false, error: "Driver profile not found." };

  if (driver.status !== DriverStatus.ACTIVE) {
    return {
      ok: false,
      error: `Driver is not active. Current status: ${driver.status}. Only ACTIVE drivers can be assigned.`,
    };
  }

  if ((driver.availability === "UNAVAILABLE" || driver.availability === "ON_DELIVERY") && !allowUnavailable) {
    return {
      ok: false,
      error: "Driver is currently unavailable for new offers.",
      warn: "Use overrideReason to assign an UNAVAILABLE driver.",
    };
  }

  if (driver.availability === "OFFLINE" && !allowUnavailable) {
    return {
      ok: false,
      error: "Driver is currently OFFLINE.",
      warn: "Use overrideReason to assign an OFFLINE driver.",
    };
  }

  return { ok: true };
}

// ─── Core: create assignment inside a transaction ─────────────────────────────

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export async function createAssignmentInTx(
  tx: TxClient,
  params: {
    orderId: string;
    driverProfileId: string;
    assignedByAdminId: string;
    adminNote?: string;
    reassignedFromId?: string;
  }
) {
  const assignment = await tx.orderAssignment.create({
    data: {
      orderId: params.orderId,
      driverProfileId: params.driverProfileId,
      assignedByAdminId: params.assignedByAdminId,
      status: OrderAssignmentStatus.ASSIGNED,
      assignedAt: new Date(),
      offeredAt: new Date(),
      activeOrderGuard: params.orderId,
      adminNote: params.adminNote ?? null,
      reassignedFromId: params.reassignedFromId ?? null,
    },
  });

  await tx.orderAssignmentEvent.create({
    data: {
      assignmentId: assignment.id,
      orderId: params.orderId,
      driverProfileId: params.driverProfileId,
      actorUserId: params.assignedByAdminId,
      actorRole: "ADMIN",
      eventType: params.reassignedFromId
        ? OrderAssignmentEventType.ASSIGNMENT_REASSIGNED
        : OrderAssignmentEventType.ASSIGNMENT_CREATED,
      previousStatus: null,
      newStatus: OrderAssignmentStatus.ASSIGNED,
      note: params.adminNote ?? null,
    },
  });

  return assignment;
}

// ─── Core: cancel assignment inside a transaction ─────────────────────────────

export async function cancelAssignmentInTx(
  tx: TxClient,
  params: {
    assignmentId: string;
    orderId: string;
    driverProfileId: string;
    actorUserId: string;
    actorRole: string;
    reason: string;
    previousStatus: OrderAssignmentStatus;
  }
) {
  if (!isValidAssignmentTransition(params.previousStatus, OrderAssignmentStatus.CANCELLED)) {
    throw new Error(
      `Cannot cancel assignment in status ${params.previousStatus}.`
    );
  }

  const updated = await tx.orderAssignment.update({
    where: { id: params.assignmentId },
    data: {
      status: OrderAssignmentStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledByAdminId: params.actorRole === "ADMIN" ? params.actorUserId : null,
      cancellationReason: params.reason,
      activeOrderGuard: null,
      version: { increment: 1 },
    },
  });

  await tx.orderAssignmentEvent.create({
    data: {
      assignmentId: params.assignmentId,
      orderId: params.orderId,
      driverProfileId: params.driverProfileId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      eventType: OrderAssignmentEventType.ASSIGNMENT_CANCELLED,
      previousStatus: params.previousStatus,
      newStatus: OrderAssignmentStatus.CANCELLED,
      note: params.reason,
    },
  });

  return updated;
}

// ─── Core: transition assignment status ───────────────────────────────────────

export async function transitionAssignmentInTx(
  tx: TxClient,
  params: {
    assignmentId: string;
    orderId: string;
    driverProfileId: string;
    actorUserId: string;
    actorRole: string;
    from: OrderAssignmentStatus;
    to: OrderAssignmentStatus;
    eventType: OrderAssignmentEventType;
    data: Record<string, unknown>;
    note?: string;
  }
) {
  if (!isValidAssignmentTransition(params.from, params.to)) {
    throw new Error(
      `Invalid assignment transition from ${params.from} to ${params.to}.`
    );
  }

  const updated = await tx.orderAssignment.update({
    where: { id: params.assignmentId },
    data: params.data as Parameters<typeof tx.orderAssignment.update>[0]["data"],
  });

  await tx.orderAssignmentEvent.create({
    data: {
      assignmentId: params.assignmentId,
      orderId: params.orderId,
      driverProfileId: params.driverProfileId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      eventType: params.eventType,
      previousStatus: params.from,
      newStatus: params.to,
      note: params.note ?? null,
    },
  });

  return updated;
}

// ─── Verify driver owns assignment ────────────────────────────────────────────

export async function getAssignmentOwnedByDriver(
  assignmentId: string,
  driverProfileId: string
) {
  return prisma.orderAssignment.findFirst({
    where: { id: assignmentId, driverProfileId },
    include: ASSIGNMENT_FULL_INCLUDE,
  });
}

// ─── Check if assignment is active ───────────────────────────────────────────

export function requireActiveAssignment(
  assignment: { status: OrderAssignmentStatus } | null,
  errorMessage = "No active assignment found."
): { ok: true } | { ok: false; error: string } {
  if (!assignment) return { ok: false, error: errorMessage };
  if (!isActiveAssignment(assignment.status)) {
    return { ok: false, error: `Assignment is already in a terminal state: ${assignment.status}.` };
  }
  return { ok: true };
}
