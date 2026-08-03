import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = vi.hoisted(() => ({
  address: {
    create: vi.fn(),
  },
  order: {
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  orderStatusHistory: {
    create: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  store: {
    findFirst: vi.fn(),
  },
  order: {
    findFirst: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const transitionOrderStatusInTxMock = vi.hoisted(() => vi.fn());
const notifyOrderConfirmedMock = vi.hoisted(() => vi.fn());
const notifyOrderStatusChangedMock = vi.hoisted(() => vi.fn());
const estimateDeliveryPriceMock = vi.hoisted(() => vi.fn());
const createPricingAuditLogMock = vi.hoisted(() => vi.fn());
const calculateRouteMock = vi.hoisted(() => vi.fn());
const checkDeliveryZoneMock = vi.hoisted(() => vi.fn());
const matchRegionByCityMock = vi.hoisted(() => vi.fn());
const generateOrderNumberMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/services/order-status.service", () => ({
  transitionOrderStatusInTx: transitionOrderStatusInTxMock,
}));
vi.mock("@/lib/services/notification-events.service", () => ({
  notifyOrderConfirmed: notifyOrderConfirmedMock,
  notifyOrderStatusChanged: notifyOrderStatusChangedMock,
}));
vi.mock("@/lib/services/pricing.service", () => ({
  estimateDeliveryPrice: estimateDeliveryPriceMock,
  createPricingAuditLog: createPricingAuditLogMock,
}));
vi.mock("@/lib/maps/routes.service", () => ({ calculateRoute: calculateRouteMock }));
vi.mock("@/lib/maps/delivery-zone.service", () => ({
  checkDeliveryZone: checkDeliveryZoneMock,
  matchRegionByCity: matchRegionByCityMock,
}));
vi.mock("@/lib/utils/order-number", () => ({
  generateOrderNumber: generateOrderNumberMock,
}));

import { cancelOrder } from "@/lib/services/orders.service";
import { DeliveryType, OrderSource, OrderStatus, UserRole, UserStatus } from "@/types/db";
import type { AuthenticatedUser } from "@/types/domain";

const customer: AuthenticatedUser = {
  id: "customer-1",
  email: "customer@example.test",
  name: "Customer",
  role: UserRole.CUSTOMER,
  status: UserStatus.ACTIVE,
};

function fullOrder(status: OrderStatus) {
  return {
    id: "order-1",
    orderNumber: "KT-0001",
    source: OrderSource.CUSTOMER,
    status,
    deliveryType: DeliveryType.SAME_DAY,
    currency: "ZAR",
    customerId: customer.id,
    storeId: null,
    pickupAddressId: "pickup-1",
    dropoffAddressId: "dropoff-1",
    recipientName: "Recipient",
    recipientPhone: "123456789",
    parcelDescription: null,
    parcelCount: 1,
    scheduledFor: null,
    priceEstimate: null,
    adminNote: null,
    customerNote: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deliveryRegionId: null,
    distanceMeters: null,
    durationSeconds: null,
    routeCalculatedAt: null,
    routeProvider: null,
    routeSummary: null,
    pickupAddress: null,
    dropoffAddress: null,
    deliveryRegion: null,
    statusHistory: [],
    customer,
    store: null,
  };
}

describe("orders service status flows", () => {
  beforeEach(() => {
    prismaMock.store.findFirst.mockReset();
    prismaMock.order.findFirst.mockReset();
    prismaMock.order.count.mockReset();
    prismaMock.order.findMany.mockReset();
    prismaMock.$transaction.mockReset();
    txMock.order.findUniqueOrThrow.mockReset();
    transitionOrderStatusInTxMock.mockReset();
    notifyOrderConfirmedMock.mockReset();
    notifyOrderStatusChangedMock.mockReset();
    estimateDeliveryPriceMock.mockReset();
    createPricingAuditLogMock.mockReset();
    calculateRouteMock.mockReset();
    checkDeliveryZoneMock.mockReset();
    matchRegionByCityMock.mockReset();
    generateOrderNumberMock.mockReset();

    prismaMock.$transaction.mockImplementation(async (callback) => callback(txMock));
  });

  it("uses the central transition service for customer cancellation", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "order-1",
      orderNumber: "KT-0001",
      status: OrderStatus.PENDING,
      source: OrderSource.CUSTOMER,
    });
    txMock.order.findUniqueOrThrow.mockResolvedValue(fullOrder(OrderStatus.CANCELLED));

    const result = await cancelOrder(customer, "order-1", {
      reason: "No longer needed.",
    });

    expect("error" in result).toBe(false);
    expect(transitionOrderStatusInTxMock).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        orderId: "order-1",
        fromStatus: OrderStatus.PENDING,
        toStatus: OrderStatus.CANCELLED,
        actorUserId: customer.id,
        actorRole: UserRole.CUSTOMER,
        source: "customer_cancel_order",
      })
    );
    expect(notifyOrderStatusChangedMock).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: OrderStatus.CANCELLED })
    );
  });

  it("rejects customer cancellation after pickup without calling transition service", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "order-1",
      orderNumber: "KT-0001",
      status: OrderStatus.PICKED_UP,
      source: OrderSource.CUSTOMER,
    });

    const result = await cancelOrder(customer, "order-1", {});

    expect(result).toEqual({
      error:
        "This order cannot be cancelled once it has progressed to PICKED_UP. Please contact KT Couriers for assistance.",
    });
    expect(transitionOrderStatusInTxMock).not.toHaveBeenCalled();
  });
});
