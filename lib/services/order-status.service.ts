import { prisma } from "@/lib/db/prisma";
import { appendOrderStatusChangedInTx } from "./notification-events.service";
import { recordAdminAlertIntentInTx } from "@/lib/notifications/admin-alert-dispatch.service";
import type { AdminAlertEventType } from "@/lib/settings/admin-alert-recipient-policy";
import {
  assertCourierOrderTransitionFundingInTx,
  isCourierProgressStatus,
} from "./courier-payment-readiness.service";
import { Prisma as PrismaNamespace } from "@prisma/client";
import {
  OrderOperationalEventType,
  OrderStatus,
  type Order,
  type Prisma,
} from "@/types/db";
import {
  assertOrderStatusTransition,
  OrderTransitionError,
  type OrderTransitionActorRole,
  type OrderTransitionContext,
} from "@/lib/orders/order-state-machine";

type TxClient = Prisma.TransactionClient;

export type OrderStatusTransitionAudit = {
  eventType?: OrderOperationalEventType;
  assignmentId?: string | null;
  driverProfileId?: string | null;
  publicNote?: string | null;
  internalNote?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type TransitionOrderStatusArgs = {
  orderId: string;
  toStatus: OrderStatus;
  actorUserId?: string | null;
  actorRole: OrderTransitionActorRole;
  reason?: string;
  note?: string;
  internalNote?: string;
  metadata?: Record<string, unknown>;
  source?: string;
  context?: OrderTransitionContext;
  audit?: OrderStatusTransitionAudit;
};

export function transitionReasonFromArgs(
  args: Pick<TransitionOrderStatusArgs, "reason" | "note" | "internalNote">
): string | null {
  return args.reason?.trim() || args.note?.trim() || args.internalNote?.trim() || null;
}

function historyNote(args: TransitionOrderStatusArgs): string | null {
  if (args.note?.trim()) return args.note.trim();
  if (args.reason?.trim()) return args.reason.trim();
  return null;
}

function historyInternalNote(args: TransitionOrderStatusArgs): string | null {
  const parts = [
    args.internalNote?.trim() || null,
    args.source ? `Source: ${args.source}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : null;
}

export async function transitionOrderStatusInTx(
  tx: TxClient,
  args: TransitionOrderStatusArgs & { fromStatus?: OrderStatus }
): Promise<Order> {
  if (typeof tx.$queryRaw === "function") {
    await tx.$queryRaw(PrismaNamespace.sql`SELECT "id" FROM "Order" WHERE "id" = ${args.orderId} FOR UPDATE`);
  }

  const current =
    args.fromStatus ??
    (
      await tx.order.findUnique({
        where: { id: args.orderId },
        select: { status: true },
      })
    )?.status;

  if (!current) {
    throw new OrderTransitionError("Order not found.", "INVALID_TRANSITION");
  }

  const context: OrderTransitionContext = {
    ...args.context,
    reason: args.context?.reason ?? transitionReasonFromArgs(args),
  };

  assertOrderStatusTransition({
    from: current,
    to: args.toStatus,
    actorRole: args.actorRole,
    context,
  });

  if (current === args.toStatus) {
    return tx.order.findUniqueOrThrow({ where: { id: args.orderId } });
  }

  if (isCourierProgressStatus(args.toStatus)) {
    await assertCourierOrderTransitionFundingInTx(tx, args.orderId, args.toStatus);
  }

  const updateResult = await tx.order.updateMany({
    where: { id: args.orderId, status: current },
    data: { status: args.toStatus },
  });

  if (updateResult.count !== 1) {
    throw new OrderTransitionError(
      "Order status changed before the transition could be applied.",
      "INVALID_TRANSITION"
    );
  }

  const history = await tx.orderStatusHistory.create({
    data: {
      orderId: args.orderId,
      status: args.toStatus,
      note: historyNote(args),
      internalNote: historyInternalNote(args),
      actorUserId: args.actorUserId ?? null,
    },
  });

  if (args.audit?.eventType && args.actorUserId) {
    await tx.orderOperationalEvent.create({
      data: {
        orderId: args.orderId,
        assignmentId: args.audit.assignmentId ?? null,
        driverProfileId: args.audit.driverProfileId ?? null,
        actorUserId: args.actorUserId,
        actorRole: args.actorRole,
        eventType: args.audit.eventType,
        statusBefore: current,
        statusAfter: args.toStatus,
        occurredAt: new Date(),
        publicNote: args.audit.publicNote ?? args.note ?? null,
        internalNote:
          args.audit.internalNote ??
          args.internalNote ??
          args.reason ??
          null,
        metadata:
          args.audit.metadata ??
          (args.metadata as Prisma.InputJsonValue | undefined) ??
          undefined,
      },
    });
  }

  const STATUS_ALERT_MAP: Partial<Record<OrderStatus, AdminAlertEventType>> = {
    [OrderStatus.PICKUP_SCHEDULED]: "PARCEL_DRIVER_ASSIGNED",
    [OrderStatus.PICKED_UP]: "PARCEL_PICKED_UP",
    [OrderStatus.IN_TRANSIT]: "PARCEL_IN_TRANSIT",
    [OrderStatus.DELIVERY_ATTEMPTED]: "PARCEL_DELIVERY_ATTEMPTED",
    [OrderStatus.DELIVERED]: "PARCEL_DELIVERED",
    [OrderStatus.FAILED]: "PARCEL_DELIVERY_FAILED",
    [OrderStatus.CANCELLED]: "PARCEL_ORDER_CANCELLED",
  };

  const updated = await tx.order.findUniqueOrThrow({ where: { id: args.orderId } });
  await appendOrderStatusChangedInTx(tx, updated, history.id);
  const mappedAlert = STATUS_ALERT_MAP[args.toStatus];
  if (mappedAlert) {
    await recordAdminAlertIntentInTx(tx, {
      eventType: mappedAlert,
      aggregateReference: `order-status:${history.id}`,
      title: `Parcel ${updated.orderNumber}: ${args.toStatus.replaceAll("_", " ").toLowerCase()}`,
      summary: historyNote(args) ?? `Parcel transitioned from ${current} to ${args.toStatus}.`,
      adminPath: `/admin/orders/${updated.id}`,
      relatedOrderId: updated.id,
      metadata: {
        orderNumber: updated.orderNumber,
        fromStatus: current,
        toStatus: args.toStatus,
      },
    });
  }
  return updated;
}

export async function transitionOrderStatus(
  args: TransitionOrderStatusArgs
): Promise<Order> {
  return prisma.$transaction((tx) => transitionOrderStatusInTx(tx, args));
}
