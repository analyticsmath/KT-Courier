import { prisma } from "@/lib/db/prisma";
import { OrderOperationalEventType } from "@/types/db";
import type { AuthenticatedUser } from "@/types/domain";
import {
  toAdminOperationalEventDto,
  toPublicPickupEventDto,
  toAdminPickupExceptionDto,
  type AdminOperationalEventDto,
  type PublicPickupEventDto,
  type AdminPickupExceptionDto,
} from "@/lib/dto/pickup.dto";
import { recordAdminActivity } from "./admin-activity.service";
import type { AdminOperationalNoteInput } from "@/lib/validation/pickup";

// ─── Shared include for operational event queries ─────────────────────────────

const OPERATIONAL_EVENT_INCLUDE = {
  driverProfile: {
    select: { driverCode: true, displayName: true },
  },
} as const;

// ─── Get operational events for a specific order (admin view) ─────────────────

export async function getOrderOperationalEvents(
  orderId: string
): Promise<AdminOperationalEventDto[]> {
  const events = await prisma.orderOperationalEvent.findMany({
    where: { orderId },
    include: OPERATIONAL_EVENT_INCLUDE,
    orderBy: { occurredAt: "asc" },
  });

  return events.map(toAdminOperationalEventDto);
}

/** Safe admin-only operational summary: deliberately excludes OTP code/hash and
 * raw evidence references. */
export async function getAdminOrderOperationalSummary(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      custodyEstablishedAt: true, transitStartedAt: true,
      deliveryAttempts: { select: { id: true, attemptNumber: true, reason: true, retryable: true, publicNote: true, occurredAt: true }, orderBy: { attemptNumber: "asc" } },
      deliveryOtps: { select: { expiresAt: true, lockedAt: true, verifiedAt: true, attempts: true, maxAttempts: true }, orderBy: { createdAt: "desc" }, take: 1 },
      proofOfDelivery: { select: { method: true, recipientName: true, deliveredAt: true } },
      assignments: { where: { status: "COMPLETED" }, select: { completedAt: true }, orderBy: { completedAt: "desc" }, take: 1 },
    },
  });
  const otp = order.deliveryOtps[0] ?? null;
  return {
    custodyEstablishedAt: order.custodyEstablishedAt,
    transitStartedAt: order.transitStartedAt,
    attempts: order.deliveryAttempts,
    otp: otp ? { expiresAt: otp.expiresAt, locked: Boolean(otp.lockedAt), verified: Boolean(otp.verifiedAt), attempts: otp.attempts, maxAttempts: otp.maxAttempts } : null,
    pod: order.proofOfDelivery,
    assignmentCompletedAt: order.assignments[0]?.completedAt ?? null,
  };
}

// ─── Get operational events for a specific order (customer/store safe) ────────

export async function getPublicPickupEvents(
  orderId: string
): Promise<PublicPickupEventDto[]> {
  const events = await prisma.orderOperationalEvent.findMany({
    where: {
      orderId,
      eventType: {
        in: [
          OrderOperationalEventType.PICKUP_STARTED,
          OrderOperationalEventType.PICKUP_COMPLETED,
          OrderOperationalEventType.PICKUP_FAILED,
        ],
      },
    },
    include: OPERATIONAL_EVENT_INCLUDE,
    orderBy: { occurredAt: "asc" },
  });

  return events.map(toPublicPickupEventDto);
}

// ─── List pickup exception events (admin) ────────────────────────────────────
// Returns all PICKUP_FAILED events for admin review.

export interface PickupExceptionsFilter {
  page: number;
  pageSize: number;
  driverProfileId?: string;
  deliveryRegionId?: string;
}

export async function listPickupExceptions(
  filters: PickupExceptionsFilter
): Promise<{ data: AdminPickupExceptionDto[]; total: number }> {
  const skip = (filters.page - 1) * filters.pageSize;

  const where: Record<string, unknown> = {
    eventType: OrderOperationalEventType.PICKUP_FAILED,
  };

  if (filters.driverProfileId) where.driverProfileId = filters.driverProfileId;
  if (filters.deliveryRegionId) {
    where.order = { deliveryRegionId: filters.deliveryRegionId };
  }

  const [events, total] = await Promise.all([
    prisma.orderOperationalEvent.findMany({
      where,
      include: {
        ...OPERATIONAL_EVENT_INCLUDE,
        order: {
          select: {
            orderNumber: true,
            deliveryRegion: { select: { name: true } },
          },
        },
      },
      orderBy: { occurredAt: "desc" },
      skip,
      take: filters.pageSize,
    }),
    prisma.orderOperationalEvent.count({ where }),
  ]);

  return {
    data: events.map((e) => toAdminPickupExceptionDto(e as Parameters<typeof toAdminPickupExceptionDto>[0])),
    total,
  };
}

// ─── Count active pickup exceptions ──────────────────────────────────────────

export async function countPickupExceptions(): Promise<number> {
  return prisma.orderOperationalEvent.count({
    where: { eventType: OrderOperationalEventType.PICKUP_FAILED },
  });
}

// ─── Add admin operational note to an order ───────────────────────────────────

export async function addAdminOperationalNote(
  adminUser: AuthenticatedUser,
  orderId: string,
  input: AdminOperationalNoteInput
): Promise<{ ok: true; event: AdminOperationalEventDto } | { error: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true },
  });

  if (!order) return { error: "Order not found." };

  const event = await prisma.orderOperationalEvent.create({
    data: {
      orderId,
      actorUserId: adminUser.id,
      actorRole: "ADMIN",
      eventType: OrderOperationalEventType.ADMIN_OPERATION_NOTE_ADDED,
      statusBefore: order.status,
      statusAfter: null,
      publicNote: input.publicNote ?? null,
      internalNote: input.internalNote,
      occurredAt: new Date(),
    },
    include: OPERATIONAL_EVENT_INCLUDE,
  });

  await recordAdminActivity({
    actorUserId: adminUser.id,
    action: "CREATE",
    entityType: "Order",
    entityId: orderId,
    message: `Added operational note to order ${order.orderNumber}.`,
    metadata: { hasPublicNote: !!input.publicNote },
  });

  return { ok: true, event: toAdminOperationalEventDto(event) };
}
