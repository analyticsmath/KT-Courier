import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = vi.hoisted(() => ({
  order: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
  },
  orderStatusHistory: {
    create: vi.fn(),
  },
  orderOperationalEvent: {
    create: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import { OrderOperationalEventType, OrderStatus, UserRole } from "@/types/db";
import { OrderTransitionError } from "@/lib/orders/order-state-machine";
import { transitionOrderStatus } from "@/lib/services/order-status.service";

function order(status: OrderStatus) {
  return {
    id: "order-1",
    orderNumber: "KT-0001",
    status,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("order status service", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    txMock.order.findUnique.mockReset();
    txMock.order.findUniqueOrThrow.mockReset();
    txMock.order.updateMany.mockReset();
    txMock.orderStatusHistory.create.mockReset();
    txMock.orderOperationalEvent.create.mockReset();

    prismaMock.$transaction.mockImplementation(async (callback) => callback(txMock));
  });

  it("throws a typed transition error when the order is not found", async () => {
    txMock.order.findUnique.mockResolvedValue(null);

    await expect(
      transitionOrderStatus({
        orderId: "missing",
        toStatus: OrderStatus.CONFIRMED,
        actorRole: UserRole.ADMIN,
      })
    ).rejects.toBeInstanceOf(OrderTransitionError);

    expect(txMock.order.updateMany).not.toHaveBeenCalled();
  });

  it("updates the order and writes status history for a valid transition", async () => {
    txMock.order.findUnique.mockResolvedValue({ status: OrderStatus.PENDING });
    txMock.order.updateMany.mockResolvedValue({ count: 1 });
    txMock.order.findUniqueOrThrow.mockResolvedValue(order(OrderStatus.CONFIRMED));

    await expect(
      transitionOrderStatus({
        orderId: "order-1",
        toStatus: OrderStatus.CONFIRMED,
        actorUserId: "admin-1",
        actorRole: UserRole.ADMIN,
        note: "Confirmed by operations.",
        source: "test",
      })
    ).resolves.toMatchObject({ status: OrderStatus.CONFIRMED });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: OrderStatus.PENDING },
      data: { status: OrderStatus.CONFIRMED },
    });
    expect(txMock.orderStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        status: OrderStatus.CONFIRMED,
        actorUserId: "admin-1",
        note: "Confirmed by operations.",
        internalNote: "Source: test",
      }),
    });
  });

  it("treats same-status transitions as no-op and does not duplicate history", async () => {
    txMock.order.findUnique.mockResolvedValue({ status: OrderStatus.PENDING });
    txMock.order.findUniqueOrThrow.mockResolvedValue(order(OrderStatus.PENDING));

    await expect(
      transitionOrderStatus({
        orderId: "order-1",
        toStatus: OrderStatus.PENDING,
        actorUserId: "customer-1",
        actorRole: UserRole.CUSTOMER,
      })
    ).resolves.toMatchObject({ status: OrderStatus.PENDING });

    expect(txMock.order.updateMany).not.toHaveBeenCalled();
    expect(txMock.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it("rejects invalid transitions before updating the order", async () => {
    txMock.order.findUnique.mockResolvedValue({ status: OrderStatus.DELIVERED });

    await expect(
      transitionOrderStatus({
        orderId: "order-1",
        toStatus: OrderStatus.IN_TRANSIT,
        actorUserId: "admin-1",
        actorRole: UserRole.SUPER_ADMIN,
        context: { allowAdminOverride: true, reason: "Correction." },
      })
    ).rejects.toBeInstanceOf(OrderTransitionError);

    expect(txMock.order.updateMany).not.toHaveBeenCalled();
    expect(txMock.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it("writes admin operational audit events when requested", async () => {
    txMock.order.findUnique.mockResolvedValue({ status: OrderStatus.CONFIRMED });
    txMock.order.updateMany.mockResolvedValue({ count: 1 });
    txMock.order.findUniqueOrThrow.mockResolvedValue(order(OrderStatus.CANCELLED));

    await transitionOrderStatus({
      orderId: "order-1",
      toStatus: OrderStatus.CANCELLED,
      actorUserId: "admin-1",
      actorRole: UserRole.ADMIN,
      reason: "Customer called support.",
      note: "Cancelled by KT Couriers.",
      source: "admin_order_status_update",
      audit: {
        eventType: OrderOperationalEventType.ADMIN_OPERATION_NOTE_ADDED,
        publicNote: "Cancelled by KT Couriers.",
        internalNote: "Customer called support.",
        metadata: { from: OrderStatus.CONFIRMED, to: OrderStatus.CANCELLED },
      },
    });

    expect(txMock.orderOperationalEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        actorUserId: "admin-1",
        actorRole: UserRole.ADMIN,
        eventType: OrderOperationalEventType.ADMIN_OPERATION_NOTE_ADDED,
        statusBefore: OrderStatus.CONFIRMED,
        statusAfter: OrderStatus.CANCELLED,
        publicNote: "Cancelled by KT Couriers.",
        internalNote: "Customer called support.",
      }),
    });
  });

  it("rejects when the optimistic status guard does not update one order", async () => {
    txMock.order.findUnique.mockResolvedValue({ status: OrderStatus.PENDING });
    txMock.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      transitionOrderStatus({
        orderId: "order-1",
        toStatus: OrderStatus.CONFIRMED,
        actorUserId: "admin-1",
        actorRole: UserRole.ADMIN,
      })
    ).rejects.toBeInstanceOf(OrderTransitionError);

    expect(txMock.orderStatusHistory.create).not.toHaveBeenCalled();
  });
});
