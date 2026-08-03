import { prisma } from "@/lib/db/prisma";
import { OrderAssignmentStatus, OrderStatus } from "@/types/db";
import { WORKBENCH_ASSIGNMENT_INCLUDE } from "./pickup-custody.service";
import { toWorkbenchAssignmentDto, type WorkbenchAssignmentDto } from "@/lib/dto/pickup.dto";
import { PICKUP_ELIGIBLE_ORDER_STATUSES } from "@/lib/constants/pickup";
import { getDriverOperationActions } from "@/lib/driver-operations/operation-policy";

export type DriverWorkbenchDto = {
  availability: { value: string; revision: number; updatedAt: Date | null };
  offers: Array<{ id: string; orderNumber: string; expiresAt: Date | null; version: number }>;
  activeAssignment: {
    assignmentId: string;
    assignmentVersion: number;
    assignmentStatus: OrderAssignmentStatus;
    orderId: string;
    orderNumber: string;
    orderStatus: OrderStatus;
    custodyEstablishedAt: Date | null;
    transitStartedAt: Date | null;
    deliveryType: string;
    scheduledFor: Date | null;
    parcelCount: number;
    pickup: { label: string | null; address: string | null };
    destination: { label: string | null; address: string | null };
    attempts: Array<{ id: string; number: number; reason: string; retryable: boolean; note: string | null; occurredAt: Date }>;
    latestAttempt: { id: string; number: number; reason: string; retryable: boolean; occurredAt: Date } | null;
    otp: { required: boolean; issued: boolean; expiresAt: Date | null; locked: boolean; verified: boolean; attemptsUsed: number; maxAttempts: number };
    pod: { required: boolean; completed: boolean; method: string | null; deliveredAt: Date | null };
    actions: ReturnType<typeof getDriverOperationActions>;
  } | null;
  recentCompletions: { items: Array<{ id: string; orderNumber: string; completedAt: Date | null }>; pageInfo: { page: number; pageSize: number; total: number; totalPages: number } };
};

/** Mobile workbench query. It intentionally projects only fields needed to execute work. */
export async function getDriverWorkbench(
  driverProfileId: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<DriverWorkbenchDto> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(25, Math.max(1, options.pageSize ?? 10));
  const profile = await prisma.driverProfile.findUniqueOrThrow({
    where: { id: driverProfileId },
    select: { availability: true, availabilityRevision: true, availabilityUpdatedAt: true, status: true, userId: true },
  });
  const [offers, active, recentCompleted, completionTotal] = await Promise.all([
    prisma.orderAssignment.findMany({
      where: { driverProfileId, status: OrderAssignmentStatus.ASSIGNED },
      select: { id: true, expiresAt: true, version: true, order: { select: { orderNumber: true } } },
      orderBy: { offeredAt: "asc" },
      take: pageSize,
    }),
    prisma.orderAssignment.findFirst({
      where: { driverProfileId, status: OrderAssignmentStatus.ACCEPTED, order: { status: { notIn: [OrderStatus.DELIVERED, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.FAILED] } } },
      select: {
        id: true, version: true,
        order: { select: {
          id: true, orderNumber: true, status: true, deliveryType: true, scheduledFor: true, parcelCount: true, currentDriverProfileId: true, custodyEstablishedAt: true, transitStartedAt: true,
          pickupAddress: { select: { label: true, line1: true } },
          dropoffAddress: { select: { label: true, line1: true } },
          deliveryAttempts: { select: { id: true, attemptNumber: true, reason: true, retryable: true, publicNote: true, occurredAt: true }, orderBy: { attemptNumber: "desc" } },
          deliveryOtps: { select: { expiresAt: true, lockedAt: true, verifiedAt: true, consumedAt: true, attempts: true, maxAttempts: true }, orderBy: { createdAt: "desc" }, take: 1 },
          proofOfDelivery: { select: { method: true, deliveredAt: true } },
        } },
      },
      orderBy: { acceptedAt: "asc" },
    }),
    prisma.orderAssignment.findMany({
      where: { driverProfileId, status: OrderAssignmentStatus.COMPLETED },
      select: { id: true, completedAt: true, order: { select: { orderNumber: true } } },
      orderBy: { completedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.orderAssignment.count({ where: { driverProfileId, status: OrderAssignmentStatus.COMPLETED } }),
  ]);

  const otp = active?.order.deliveryOtps[0] ?? null;
  const attempts = (active?.order.deliveryAttempts ?? []).map((item) => ({ id: item.id, number: item.attemptNumber, reason: item.reason, retryable: item.retryable, note: item.publicNote, occurredAt: item.occurredAt }));
  const activeAssignment = active ? {
    assignmentId: active.id, assignmentVersion: active.version,
    assignmentStatus: OrderAssignmentStatus.ACCEPTED, orderId: active.order.id, orderNumber: active.order.orderNumber, orderStatus: active.order.status,
    custodyEstablishedAt: active.order.custodyEstablishedAt, transitStartedAt: active.order.transitStartedAt,
    deliveryType: active.order.deliveryType, scheduledFor: active.order.scheduledFor, parcelCount: active.order.parcelCount,
    pickup: { label: active.order.pickupAddress?.label ?? null, address: active.order.pickupAddress?.line1 ?? null },
    destination: { label: active.order.dropoffAddress?.label ?? null, address: active.order.dropoffAddress?.line1 ?? null },
    attempts,
    latestAttempt: attempts[0] ? { id: attempts[0].id, number: attempts[0].number, reason: attempts[0].reason, retryable: attempts[0].retryable, occurredAt: attempts[0].occurredAt } : null,
    otp: { required: true, issued: Boolean(otp), expiresAt: otp?.expiresAt ?? null, locked: Boolean(otp?.lockedAt), verified: Boolean(otp?.verifiedAt), attemptsUsed: otp?.attempts ?? 0, maxAttempts: otp?.maxAttempts ?? 5 },
    pod: { required: true, completed: Boolean(active.order.proofOfDelivery), method: active.order.proofOfDelivery?.method ?? null, deliveredAt: active.order.proofOfDelivery?.deliveredAt ?? null },
    actions: getDriverOperationActions({
      assignmentId: active.id, assignmentVersion: active.version, assignmentStatus: OrderAssignmentStatus.ACCEPTED,
      orderId: active.order.id, orderStatus: active.order.status, currentDriverProfileId: active.order.currentDriverProfileId,
      driverProfileId, driverActive: profile.status === "ACTIVE", driverUserId: profile.userId,
    }),
  } : null;

  return {
    availability: { value: profile.availability, revision: profile.availabilityRevision, updatedAt: profile.availabilityUpdatedAt },
    offers: offers.map((item) => ({ id: item.id, expiresAt: item.expiresAt, version: item.version, orderNumber: item.order.orderNumber })),
    activeAssignment,
    recentCompletions: { items: recentCompleted.map((item) => ({ id: item.id, orderNumber: item.order.orderNumber, completedAt: item.completedAt })), pageInfo: { page, pageSize, total: completionTotal, totalPages: Math.ceil(completionTotal / pageSize) } },
  };
}

// ─── Get all pickup-ready accepted assignments for a driver ───────────────────
// Returns assignments that are ACCEPTED and have orders in CONFIRMED or PICKUP_SCHEDULED.

export async function getWorkbenchAssignments(
  driverProfileId: string
): Promise<WorkbenchAssignmentDto[]> {
  const assignments = await prisma.orderAssignment.findMany({
    where: {
      driverProfileId,
      status: OrderAssignmentStatus.ACCEPTED,
      order: {
        status: { in: PICKUP_ELIGIBLE_ORDER_STATUSES },
      },
    },
    include: WORKBENCH_ASSIGNMENT_INCLUDE,
    orderBy: { acceptedAt: "asc" },
  });

  return assignments.map(toWorkbenchAssignmentDto);
}

// ─── Get a single workbench assignment by ID (driver-owned) ──────────────────

export async function getWorkbenchAssignment(
  assignmentId: string,
  driverProfileId: string
): Promise<WorkbenchAssignmentDto | null> {
  const assignment = await prisma.orderAssignment.findFirst({
    where: { id: assignmentId, driverProfileId },
    include: WORKBENCH_ASSIGNMENT_INCLUDE,
  });

  return assignment ? toWorkbenchAssignmentDto(assignment) : null;
}

// ─── Workbench summary stats for driver dashboard ────────────────────────────

export interface WorkbenchSummary {
  acceptedCount: number;
  pickupReadyCount: number;
  pickupInProgressCount: number;
}

export async function getWorkbenchSummary(
  driverProfileId: string
): Promise<WorkbenchSummary> {
  const accepted = await prisma.orderAssignment.findMany({
    where: {
      driverProfileId,
      status: OrderAssignmentStatus.ACCEPTED,
    },
    include: { order: { select: { status: true } } },
  });

  const pickupReady = accepted.filter(
    (a) =>
      a.order.status === OrderStatus.CONFIRMED ||
      a.order.status === OrderStatus.PICKUP_SCHEDULED
  );

  // Pickup in progress means PICKUP_SCHEDULED and has a PICKUP_STARTED event
  const pickupStartedOrderIds = await prisma.orderOperationalEvent.findMany({
    where: {
      driverProfileId,
      eventType: "PICKUP_STARTED",
      orderId: { in: pickupReady.map((a) => a.orderId) },
    },
    select: { orderId: true },
  });

  const startedIds = new Set(pickupStartedOrderIds.map((e) => e.orderId));

  return {
    acceptedCount: accepted.length,
    pickupReadyCount: pickupReady.length,
    pickupInProgressCount: startedIds.size,
  };
}
