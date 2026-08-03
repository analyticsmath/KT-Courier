import { prisma } from "@/lib/db/prisma";
import { OrderStatus, OrderSource, DeliveryType } from "@/types/db";
import { toAdminAssignmentDto, type AdminAssignmentDto } from "@/lib/dto/assignment.dto";
import { toOrderSummaryDto, type OrderSummaryDto } from "@/lib/dto/order.dto";
import {
  ASSIGNMENT_FULL_INCLUDE,
  assertOrderAssignable,
  assertDriverEligible,
  findActiveAssignment,
  createAssignmentInTx,
  cancelAssignmentInTx,
  requireActiveAssignment,
} from "./assignments.service";
import { listEligibleDrivers, type EligibleDriversResult } from "./driver-eligibility.service";
import { recordAdminActivity } from "./admin-activity.service";
import { ASSIGNABLE_ORDER_STATUSES, ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/constants/assignments";
import type { AdminAssignOrderInput, AdminReassignOrderInput, AdminCancelAssignmentInput } from "@/lib/validation/assignment";

// ─── Dispatch board data ─────────────────────────────────────────────────────

export interface DispatchBoardData {
  unassignedOrders: OrderSummaryDto[];
  assignedOrders: AdminAssignmentDto[];
  eligibleDrivers: EligibleDriversResult;
  counts: {
    unassigned: number;
    assigned: number;
    totalActive: number;
  };
}

export async function getDispatchBoardData(): Promise<DispatchBoardData> {
  // Orders assignable but with no active assignment
  const assignedOrderIds = await prisma.orderAssignment.findMany({
    where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
    select: { orderId: true },
  });
  const assignedIds = assignedOrderIds.map((a) => a.orderId);

  const [unassignedOrders, activeAssignments] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: ASSIGNABLE_ORDER_STATUSES },
        id: { notIn: assignedIds },
      },
      include: {
        pickupAddress: true,
        dropoffAddress: true,
        deliveryRegion: { select: { name: true } },
        customer: { select: { name: true, email: true } },
        store: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.orderAssignment.findMany({
      where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
      include: ASSIGNMENT_FULL_INCLUDE,
      orderBy: { assignedAt: "desc" },
      take: 100,
    }),
  ]);

  const eligibleDrivers = await listEligibleDrivers(null);

  return {
    unassignedOrders: unassignedOrders.map(toOrderSummaryDto),
    assignedOrders: activeAssignments.map(toAdminAssignmentDto),
    eligibleDrivers,
    counts: {
      unassigned: unassignedOrders.length,
      assigned: activeAssignments.length,
      totalActive: activeAssignments.length,
    },
  };
}

// ─── Assign order to driver ───────────────────────────────────────────────────

export async function assignOrderToDriver(
  adminUserId: string,
  orderId: string,
  input: AdminAssignOrderInput
): Promise<{ assignment: AdminAssignmentDto } | { error: string; warn?: string }> {
  const orderCheck = await assertOrderAssignable(orderId);
  if (!orderCheck.ok) return { error: orderCheck.error };

  const isOverride = !!input.overrideReason;
  const driverCheck = await assertDriverEligible(input.driverProfileId, isOverride);
  if (!driverCheck.ok) {
    return { error: driverCheck.error, warn: driverCheck.warn };
  }

  // Enforce: no two active assignments for the same order
  const existing = await findActiveAssignment(orderId);
  if (existing) {
    return {
      error: `Order already has an active assignment (${existing.status}). Cancel or reassign before creating a new one.`,
    };
  }

  const assignment = await prisma.$transaction(async (tx) => {
    const note = [input.adminNote, input.overrideReason ? `Override: ${input.overrideReason}` : null]
      .filter(Boolean)
      .join(" | ") || null;

    return createAssignmentInTx(tx, {
      orderId,
      driverProfileId: input.driverProfileId,
      assignedByAdminId: adminUserId,
      adminNote: note ?? undefined,
    });
  });

  await recordAdminActivity({
    actorUserId: adminUserId,
    action: "CREATE",
    entityType: "OrderAssignment",
    entityId: assignment.id,
    message: `Assigned order ${orderCheck.order!.orderNumber} to driver (profile ${input.driverProfileId}).`,
    metadata: {
      orderId,
      assignmentId: assignment.id,
      driverProfileId: input.driverProfileId,
      override: isOverride,
      overrideReason: input.overrideReason ?? null,
    },
  });

  const full = await prisma.orderAssignment.findUniqueOrThrow({
    where: { id: assignment.id },
    include: ASSIGNMENT_FULL_INCLUDE,
  });

  return { assignment: toAdminAssignmentDto(full) };
}

// ─── Reassign order to new driver ─────────────────────────────────────────────

export async function reassignOrder(
  adminUserId: string,
  orderId: string,
  input: AdminReassignOrderInput
): Promise<{ assignment: AdminAssignmentDto } | { error: string; warn?: string }> {
  const driverProfileId = input.driverProfileId ?? input.newDriverProfileId;
  const reason = input.reason ?? input.reasonCode;
  if (!driverProfileId || !reason) return { error: "New driver and reassignment reason are required." };
  const orderCheck = await assertOrderAssignable(orderId);
  if (!orderCheck.ok) return { error: orderCheck.error };

  const existingAssignment = await findActiveAssignment(orderId);
  const activeCheck = requireActiveAssignment(existingAssignment, "No active assignment to reassign.");
  if (!activeCheck.ok) return { error: activeCheck.error };

  const isOverride = !!input.overrideReason;
  const driverCheck = await assertDriverEligible(driverProfileId, isOverride);
  if (!driverCheck.ok) return { error: driverCheck.error, warn: driverCheck.warn };

  if (existingAssignment!.driverProfileId === driverProfileId) {
    return { error: "New driver must be different from the currently assigned driver." };
  }

  const newAssignment = await prisma.$transaction(async (tx) => {
    // Cancel existing
    await cancelAssignmentInTx(tx, {
      assignmentId: existingAssignment!.id,
      orderId,
      driverProfileId: existingAssignment!.driverProfileId,
      actorUserId: adminUserId,
      actorRole: "ADMIN",
      reason: `Reassigned: ${reason}`,
      previousStatus: existingAssignment!.status,
    });

    // Create new
    const note = [input.adminNote, input.overrideReason ? `Override: ${input.overrideReason}` : null]
      .filter(Boolean)
      .join(" | ") || null;

    return createAssignmentInTx(tx, {
      orderId,
      driverProfileId,
      assignedByAdminId: adminUserId,
      adminNote: note ?? undefined,
      reassignedFromId: existingAssignment!.id,
    });
  });

  await recordAdminActivity({
    actorUserId: adminUserId,
    action: "UPDATE",
    entityType: "OrderAssignment",
    entityId: newAssignment.id,
    message: `Reassigned order ${orderCheck.order!.orderNumber} from driver ${existingAssignment!.driverProfileId} to ${driverProfileId}. Reason: ${reason}`,
    metadata: {
      orderId,
      newAssignmentId: newAssignment.id,
      previousAssignmentId: existingAssignment!.id,
      previousDriverProfileId: existingAssignment!.driverProfileId,
      newDriverProfileId: driverProfileId,
      reason,
    },
  });

  const full = await prisma.orderAssignment.findUniqueOrThrow({
    where: { id: newAssignment.id },
    include: ASSIGNMENT_FULL_INCLUDE,
  });

  return { assignment: toAdminAssignmentDto(full) };
}

// ─── Cancel an active assignment ──────────────────────────────────────────────

export async function cancelOrderAssignment(
  adminUserId: string,
  orderId: string,
  input: AdminCancelAssignmentInput
): Promise<{ ok: true } | { error: string }> {
  const reason = input.reason ?? input.reasonCode;
  if (!reason) return { error: "Cancellation reason is required." };
  const existingAssignment = await findActiveAssignment(orderId);
  const activeCheck = requireActiveAssignment(existingAssignment, "No active assignment to cancel.");
  if (!activeCheck.ok) return { error: activeCheck.error };

  const orderNumber = existingAssignment!.order.orderNumber;

  await prisma.$transaction(async (tx) => {
    await cancelAssignmentInTx(tx, {
      assignmentId: existingAssignment!.id,
      orderId,
      driverProfileId: existingAssignment!.driverProfileId,
      actorUserId: adminUserId,
      actorRole: "ADMIN",
      reason,
      previousStatus: existingAssignment!.status,
    });
  });

  await recordAdminActivity({
    actorUserId: adminUserId,
    action: "STATUS_CHANGE",
    entityType: "OrderAssignment",
    entityId: existingAssignment!.id,
    message: `Cancelled assignment for order ${orderNumber}. Reason: ${reason}`,
    metadata: {
      orderId,
      assignmentId: existingAssignment!.id,
      driverProfileId: existingAssignment!.driverProfileId,
      reason,
    },
  });

  return { ok: true };
}

// ─── Get assignment detail ─────────────────────────────────────────────────────

export async function getAssignmentDetail(
  assignmentId: string
): Promise<AdminAssignmentDto | null> {
  const assignment = await prisma.orderAssignment.findUnique({
    where: { id: assignmentId },
    include: ASSIGNMENT_FULL_INCLUDE,
  });
  return assignment ? toAdminAssignmentDto(assignment) : null;
}

// ─── Get order's active assignment ────────────────────────────────────────────

export async function getOrderActiveAssignment(
  orderId: string
): Promise<AdminAssignmentDto | null> {
  const assignment = await findActiveAssignment(orderId);
  return assignment ? toAdminAssignmentDto(assignment) : null;
}

// ─── Get order's full assignment history ─────────────────────────────────────

export async function getOrderAssignmentHistory(
  orderId: string
): Promise<AdminAssignmentDto[]> {
  const assignments = await prisma.orderAssignment.findMany({
    where: { orderId },
    include: ASSIGNMENT_FULL_INCLUDE,
    orderBy: { assignedAt: "desc" },
  });
  return assignments.map(toAdminAssignmentDto);
}

// ─── List assignable orders ───────────────────────────────────────────────────

export interface AdminOrderListWithAssignmentFilters {
  status?: OrderStatus;
  source?: OrderSource;
  deliveryType?: DeliveryType;
  assignmentFilter?: "unassigned" | "assigned" | "all";
  search?: string;
  page: number;
  pageSize: number;
}

export async function listOrdersWithAssignmentState(
  filters: AdminOrderListWithAssignmentFilters
): Promise<{ data: (OrderSummaryDto & { activeAssignment: AdminAssignmentDto | null })[]; total: number }> {
  const skip = (filters.page - 1) * filters.pageSize;

  const assignedOrderIds = await prisma.orderAssignment.findMany({
    where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
    select: { orderId: true },
  });
  const assignedIds = assignedOrderIds.map((a) => a.orderId);

  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.source) where.source = filters.source;
  if (filters.deliveryType) where.deliveryType = filters.deliveryType;

  if (filters.assignmentFilter === "unassigned") {
    where.id = { notIn: assignedIds };
    where.status = { in: ASSIGNABLE_ORDER_STATUSES };
  } else if (filters.assignmentFilter === "assigned") {
    where.id = { in: assignedIds };
  }

  if (filters.search) {
    const q = filters.search.trim().slice(0, 80);
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { recipientName: { contains: q, mode: "insensitive" } },
      { customer: { email: { contains: q, mode: "insensitive" } } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { store: { name: { contains: q, mode: "insensitive" } } },
      { pickupAddress: { city: { contains: q, mode: "insensitive" } } },
      { dropoffAddress: { city: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        pickupAddress: true,
        dropoffAddress: true,
        deliveryRegion: { select: { name: true } },
        customer: { select: { name: true, email: true } },
        store: { select: { name: true } },
        assignments: {
          where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
          include: ASSIGNMENT_FULL_INCLUDE,
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data: orders.map((order) => ({
      ...toOrderSummaryDto(order),
      activeAssignment: order.assignments[0]
        ? toAdminAssignmentDto(order.assignments[0])
        : null,
    })),
    total,
  };
}
