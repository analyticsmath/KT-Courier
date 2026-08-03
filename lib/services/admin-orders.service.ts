import { prisma } from "@/lib/db/prisma";
import { OrderOperationalEventType, OrderStatus, OrderSource, DeliveryType, type Prisma } from "@/types/db";
import type { AuthenticatedUser } from "@/types/domain";
import {
  toOrderSummaryDto,
  toAdminOrderDetailDto,
  type OrderSummaryDto,
  type AdminOrderDetailDto,
  type AdminOrderCountsDto,
} from "@/lib/dto/order.dto";
import { recordAdminActivity } from "./admin-activity.service";
import { notifyOrderStatusChanged } from "./notification-events.service";
import {
  OrderTransitionError,
} from "@/lib/orders/order-state-machine";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";

const ORDER_FULL_INCLUDE = {
  pickupAddress: true,
  dropoffAddress: true,
  deliveryRegion: { select: { name: true } },
  statusHistory: {
    include: { actorUser: true },
    orderBy: { createdAt: "asc" as const },
  },
  customer: true,
  store: true,
} as const;

const ORDER_LIST_INCLUDE = {
  pickupAddress: true,
  dropoffAddress: true,
  deliveryRegion: { select: { name: true } },
  customer: { select: { name: true, email: true } },
  store: { select: { name: true } },
} as const;

const ORDER_STATUS_UPDATE_INCLUDE = {
  ...ORDER_FULL_INCLUDE,
  store: { include: { ownerUser: { select: { id: true, email: true, name: true } } } },
} as const;

type AdminOrderStatusUpdateOrder = Prisma.OrderGetPayload<{
  include: typeof ORDER_STATUS_UPDATE_INCLUDE;
}>;

// ─── List ─────────────────────────────────────────────────────────────────────

export interface AdminOrderListFilters {
  status?: OrderStatus;
  source?: OrderSource;
  deliveryType?: DeliveryType;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listAdminOrders(
  filters: AdminOrderListFilters
): Promise<{ data: OrderSummaryDto[]; total: number }> {
  const skip = (filters.page - 1) * filters.pageSize;

  const where: Record<string, unknown> = {};

  if (filters.status) where.status = filters.status;
  if (filters.source) where.source = filters.source;
  if (filters.deliveryType) where.deliveryType = filters.deliveryType;
  if (filters.search) {
    const q = filters.search.trim().slice(0, 80);
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { recipientName: { contains: q, mode: "insensitive" } },
      { recipientPhone: { contains: q, mode: "insensitive" } },
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
      include: ORDER_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { data: orders.map(toOrderSummaryDto), total };
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getAdminOrderDetail(id: string): Promise<AdminOrderDetailDto | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: ORDER_FULL_INCLUDE,
  });
  return order ? toAdminOrderDetailDto(order) : null;
}

// ─── Status update ────────────────────────────────────────────────────────────

export async function updateAdminOrderStatus(
  adminUser: AuthenticatedUser,
  orderId: string,
  input: { status: OrderStatus; note?: string; internalNote?: string }
): Promise<{ order: AdminOrderDetailDto } | { error: string }> {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true },
  });

  if (!existing) return { error: "Order not found." };

  if (existing.status === input.status) {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: ORDER_FULL_INCLUDE,
    });
    return { order: toAdminOrderDetailDto(order) };
  }

  let updated: AdminOrderStatusUpdateOrder;
  try {
    updated = await prisma.$transaction(async (tx) => {
      await transitionOrderStatusInTx(tx, {
        orderId,
        fromStatus: existing.status,
        toStatus: input.status,
        actorUserId: adminUser.id,
        actorRole: adminUser.role,
        reason: input.internalNote ?? input.note,
        note: input.note,
        internalNote: input.internalNote,
        source: "admin_order_status_update",
        context: {
          allowAdminOverride: true,
          reason: input.internalNote ?? input.note,
        },
        audit: {
          eventType: OrderOperationalEventType.ADMIN_OPERATION_NOTE_ADDED,
          publicNote: input.note ?? null,
          internalNote:
            input.internalNote ??
            `Admin status update from ${existing.status} to ${input.status}.`,
          metadata: {
            from: existing.status,
            to: input.status,
            source: "admin_order_status_update",
          },
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: ORDER_STATUS_UPDATE_INCLUDE,
      });
    });
  } catch (error) {
    if (error instanceof OrderTransitionError) {
      return { error: error.message };
    }
    throw error;
  }

  await recordAdminActivity({
    actorUserId: adminUser.id,
    action: "STATUS_CHANGE",
    entityType: "Order",
    entityId: orderId,
    message: `Updated order ${existing.orderNumber} status from ${existing.status} to ${input.status}.`,
    metadata: { from: existing.status, to: input.status, note: input.note },
  });

  const customerEmail = updated.customer?.email ?? null;
  const storeOwnerEmail = updated.store && "ownerUser" in updated.store
    ? (updated.store as { ownerUser?: { email: string; name: string | null } | null }).ownerUser?.email ?? null
    : null;
  const recipientEmail = customerEmail ?? storeOwnerEmail;
  const recipientName = updated.customer?.name ?? updated.customer?.email ?? storeOwnerEmail ?? "there";

  if (recipientEmail) {
    // Only send public note in email — never internalNote
    notifyOrderStatusChanged({
      recipientEmail,
      recipientName,
      orderNumber: existing.orderNumber,
      newStatus: input.status,
      statusNote: input.note,
      orderId,
      source: updated.source,
    });
  }

  return { order: toAdminOrderDetailDto(updated) };
}

// ─── Dashboard counts ─────────────────────────────────────────────────────────

export async function getAdminOrderCounts(): Promise<AdminOrderCountsDto> {
  const [
    total,
    pending,
    confirmed,
    pickupScheduled,
    pickedUp,
    inTransit,
    inProgress,
    deliveryAttempted,
    delivered,
    completed,
    cancelled,
    failed,
    withRoute,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: OrderStatus.PENDING } }),
    prisma.order.count({ where: { status: OrderStatus.CONFIRMED } }),
    prisma.order.count({ where: { status: OrderStatus.PICKUP_SCHEDULED } }),
    prisma.order.count({ where: { status: OrderStatus.PICKED_UP } }),
    prisma.order.count({ where: { status: OrderStatus.IN_TRANSIT } }),
    prisma.order.count({ where: { status: OrderStatus.IN_PROGRESS } }),
    prisma.order.count({ where: { status: OrderStatus.DELIVERY_ATTEMPTED } }),
    prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
    prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
    prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
    prisma.order.count({ where: { status: OrderStatus.FAILED } }),
    prisma.order.count({ where: { distanceMeters: { not: null } } }),
  ]);

  return {
    total,
    pending,
    confirmed,
    pickupScheduled,
    pickedUp,
    inTransit,
    inProgress,
    deliveryAttempted,
    delivered,
    completed,
    cancelled,
    failed,
    withRoute,
    withoutRoute: total - withRoute,
  };
}
