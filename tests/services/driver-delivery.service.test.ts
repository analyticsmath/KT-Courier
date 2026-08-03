import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = vi.hoisted(() => ({
  order: {
    update: vi.fn(),
  },
  orderOperationalEvent: {
    create: vi.fn(),
  },
  orderAssignmentEvent: {
    create: vi.fn(),
  },
  orderAssignment: {
    update: vi.fn(),
  },
  proofOfDelivery: {
    create: vi.fn(),
  },
  driverProfile: {
    update: vi.fn(),
  },
  driverOperationCommand: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
  deliveryAttempt: {
    aggregate: vi.fn(),
    create: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  orderAssignment: {
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
  },
  driverProfile: {
    update: vi.fn(),
  },
  driverOperationCommand: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const transitionOrderStatusInTxMock = vi.hoisted(() => vi.fn());
const verifyDeliveryOtpMock = vi.hoisted(() => vi.fn());
const verifyDeliveryOtpInTxMock = vi.hoisted(() => vi.fn());
const notifyOrderStatusChangedMock = vi.hoisted(() => vi.fn());
const recordAdminActivityMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/services/order-status.service", () => ({
  transitionOrderStatusInTx: transitionOrderStatusInTxMock,
}));
vi.mock("@/lib/services/delivery-otp.service", () => ({
  verifyDeliveryOtp: verifyDeliveryOtpMock,
  verifyDeliveryOtpInTx: verifyDeliveryOtpInTxMock,
}));
vi.mock("@/lib/services/notification-events.service", () => ({
  notifyOrderStatusChanged: notifyOrderStatusChangedMock,
}));
vi.mock("@/lib/services/admin-activity.service", () => ({
  recordAdminActivity: recordAdminActivityMock,
}));

import {
  completeDelivery,
  recordDeliveryAttempted,
  startDelivery,
} from "@/lib/services/delivery-execution.service";
import {
  DeliveryExceptionReason,
  DriverAvailability,
  DriverStatus,
  OrderAssignmentStatus,
  OrderStatus,
} from "@/types/db";

function assignment(status: OrderStatus) {
  return {
    id: "assignment-1",
    orderId: "order-1",
    driverProfileId: "driver-profile-1",
    status: OrderAssignmentStatus.ACCEPTED,
    version: 1,
    driverProfile: {
      id: "driver-profile-1",
      userId: "driver-user-1",
      status: DriverStatus.ACTIVE,
      availability: DriverAvailability.ON_DELIVERY,
      driverCode: "DRV-1",
      displayName: "Driver",
      user: {
        status: "ACTIVE",
        role: "DRIVER",
      },
    },
    order: {
      id: "order-1",
      orderNumber: "KT-0001",
      status,
      source: "CUSTOMER",
      currentDriverProfileId: "driver-profile-1",
      pickupAddress: null,
      dropoffAddress: null,
      deliveryRegion: null,
    },
    operationalEvents: [],
  };
}

describe("driver delivery service status flows", () => {
  beforeEach(() => {
    prismaMock.orderAssignment.findFirst.mockReset();
    prismaMock.orderAssignment.count.mockReset();
    prismaMock.order.findUnique.mockReset();
    prismaMock.driverProfile.update.mockReset();
    prismaMock.$transaction.mockReset();
    txMock.order.update.mockReset();
    txMock.orderOperationalEvent.create.mockReset();
    txMock.orderAssignmentEvent.create.mockReset();
    txMock.orderAssignment.update.mockReset();
    txMock.proofOfDelivery.create.mockReset();
    txMock.driverProfile.update.mockReset();
    prismaMock.driverOperationCommand.findUnique.mockReset();
    txMock.driverOperationCommand.create.mockReset();
    txMock.driverOperationCommand.update.mockReset();
    txMock.deliveryAttempt.aggregate.mockReset();
    txMock.deliveryAttempt.create.mockReset();
    txMock.proofOfDelivery.create.mockReset();
    txMock.$queryRaw.mockReset();
    transitionOrderStatusInTxMock.mockReset();
    verifyDeliveryOtpMock.mockReset();
    verifyDeliveryOtpInTxMock.mockReset();
    notifyOrderStatusChangedMock.mockReset();
    recordAdminActivityMock.mockReset();

    prismaMock.$transaction.mockImplementation(async (callback) => callback(txMock));
    prismaMock.driverOperationCommand.findUnique.mockResolvedValue(null);
    txMock.driverOperationCommand.findUnique.mockResolvedValue(null);
    txMock.$queryRaw.mockResolvedValue([{ id: "order-1" }]);
    txMock.deliveryAttempt.aggregate.mockResolvedValue({ _max: { attemptNumber: 0 } });
    txMock.deliveryAttempt.create.mockResolvedValue({ id: "attempt-1" });
    txMock.proofOfDelivery.create.mockResolvedValue({ id: "pod-1" });
    prismaMock.orderAssignment.findFirst.mockImplementation(async () =>
      assignment(OrderStatus.IN_TRANSIT)
    );
    prismaMock.orderAssignment.count.mockResolvedValue(0);
    prismaMock.order.findUnique.mockResolvedValue({
      orderNumber: "KT-0001",
      source: "CUSTOMER",
      customer: { email: "customer@example.test", name: "Customer" },
      store: null,
    });
  });

  it("uses central transition service when starting delivery from picked up", async () => {
    prismaMock.orderAssignment.findFirst.mockResolvedValueOnce(
      assignment(OrderStatus.PICKED_UP)
    );
    prismaMock.orderAssignment.findFirst.mockResolvedValueOnce(
      assignment(OrderStatus.PICKED_UP)
    );
    prismaMock.orderAssignment.findFirst.mockResolvedValueOnce(
      assignment(OrderStatus.IN_TRANSIT)
    );

    const result = await startDelivery(
      "assignment-1",
      "driver-profile-1",
      "driver-user-1",
      { operationId: "op-1", assignmentVersion: 1 }
    );

    expect(result.ok).toBe(true);
    expect(transitionOrderStatusInTxMock).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        orderId: "order-1",
        fromStatus: OrderStatus.PICKED_UP,
        toStatus: OrderStatus.IN_TRANSIT,
        actorRole: "DRIVER",
        source: "driver_delivery_start",
      })
    );
  });

  it("uses central transition service for delivery attempts", async () => {
    prismaMock.orderAssignment.findFirst.mockResolvedValueOnce(
      assignment(OrderStatus.IN_TRANSIT)
    );
    prismaMock.orderAssignment.findFirst.mockResolvedValueOnce(
      assignment(OrderStatus.IN_TRANSIT)
    );
    prismaMock.orderAssignment.findFirst.mockResolvedValueOnce(
      assignment(OrderStatus.DELIVERY_ATTEMPTED)
    );

    const result = await recordDeliveryAttempted(
      "assignment-1",
      "driver-profile-1",
      "driver-user-1",
      {
        operationId: "op-2",
        assignmentVersion: 1,
        reason: DeliveryExceptionReason.RECIPIENT_UNAVAILABLE,
        driverNote: "Recipient did not answer.",
      }
    );

    expect(result.ok).toBe(true);
    expect(transitionOrderStatusInTxMock).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        fromStatus: OrderStatus.IN_TRANSIT,
        toStatus: OrderStatus.DELIVERY_ATTEMPTED,
        source: "driver_delivery_attempt",
      })
    );
  });

  it("verifies OTP before transitioning delivery to delivered", async () => {
    prismaMock.orderAssignment.findFirst.mockResolvedValueOnce(
      assignment(OrderStatus.IN_TRANSIT)
    );
    prismaMock.orderAssignment.findFirst.mockResolvedValueOnce(
      assignment(OrderStatus.IN_TRANSIT)
    );
    prismaMock.orderAssignment.findFirst.mockResolvedValueOnce(
      assignment(OrderStatus.DELIVERED)
    );
    verifyDeliveryOtpInTxMock.mockResolvedValue({ ok: true, otpId: "otp-1" });

    const result = await completeDelivery(
      "assignment-1",
      "driver-profile-1",
      "driver-user-1",
      {
        operationId: "op-3",
        assignmentVersion: 1,
        otpCode: "123456",
        recipientName: "Recipient",
        confirmDelivery: true,
      }
    );

    expect(result.ok).toBe(true);
    expect(verifyDeliveryOtpInTxMock).toHaveBeenCalledWith(txMock, "order-1", "123456");
    expect(txMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { currentDriverProfileId: null },
    });
    expect(transitionOrderStatusInTxMock).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        fromStatus: OrderStatus.IN_TRANSIT,
        toStatus: OrderStatus.DELIVERED,
        source: "driver_delivery_complete",
        context: expect.objectContaining({
          hasValidDeliveryOtp: true,
          hasDeliveryProof: true,
        }),
      })
    );
  });

  it("does not transition delivery when OTP verification fails", async () => {
    prismaMock.orderAssignment.findFirst.mockResolvedValueOnce(
      assignment(OrderStatus.IN_TRANSIT)
    );
    prismaMock.orderAssignment.findFirst.mockResolvedValueOnce(
      assignment(OrderStatus.IN_TRANSIT)
    );
    verifyDeliveryOtpInTxMock.mockResolvedValue({
      ok: false,
      error: "No active delivery OTP found. Please request a new code.",
    });

    const result = await completeDelivery(
      "assignment-1",
      "driver-profile-1",
      "driver-user-1",
      {
        operationId: "op-4",
        assignmentVersion: 1,
        otpCode: "123456",
        recipientName: "Recipient",
        confirmDelivery: true,
      }
    );

    expect(result).toEqual({
      ok: false,
      error: "No active delivery OTP found. Please request a new code.",
    });
    expect(transitionOrderStatusInTxMock).not.toHaveBeenCalled();
  });
});
