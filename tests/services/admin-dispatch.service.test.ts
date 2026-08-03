import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  orderAssignment: {
    findUniqueOrThrow: vi.fn(),
  },
}));

const assertOrderAssignableMock = vi.hoisted(() => vi.fn());
const assertDriverEligibleMock = vi.hoisted(() => vi.fn());
const findActiveAssignmentMock = vi.hoisted(() => vi.fn());
const createAssignmentInTxMock = vi.hoisted(() => vi.fn());
const recordAdminActivityMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/services/assignments.service", () => ({
  ASSIGNMENT_FULL_INCLUDE: {},
  assertOrderAssignable: assertOrderAssignableMock,
  assertDriverEligible: assertDriverEligibleMock,
  findActiveAssignment: findActiveAssignmentMock,
  createAssignmentInTx: createAssignmentInTxMock,
  cancelAssignmentInTx: vi.fn(),
  requireActiveAssignment: vi.fn((assignment, message = "No active assignment found.") =>
    assignment ? { ok: true } : { ok: false, error: message }
  ),
}));
vi.mock("@/lib/services/driver-eligibility.service", () => ({
  listEligibleDrivers: vi.fn(),
}));
vi.mock("@/lib/services/admin-activity.service", () => ({
  recordAdminActivity: recordAdminActivityMock,
}));

import { assignOrderToDriver } from "@/lib/services/admin-dispatch.service";
import { OrderAssignmentStatus, OrderStatus } from "@/types/db";

describe("admin dispatch service", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    prismaMock.orderAssignment.findUniqueOrThrow.mockReset();
    assertOrderAssignableMock.mockReset();
    assertDriverEligibleMock.mockReset();
    findActiveAssignmentMock.mockReset();
    createAssignmentInTxMock.mockReset();
    recordAdminActivityMock.mockReset();

    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({ orderAssignment: {} })
    );
    assertOrderAssignableMock.mockResolvedValue({
      ok: true,
      order: {
        id: "order-1",
        orderNumber: "KT-0001",
        status: OrderStatus.CONFIRMED,
      },
    });
    assertDriverEligibleMock.mockResolvedValue({ ok: true });
    findActiveAssignmentMock.mockResolvedValue(null);
    createAssignmentInTxMock.mockResolvedValue({
      id: "assignment-1",
      orderId: "order-1",
      driverProfileId: "driver-profile-1",
      status: OrderAssignmentStatus.ASSIGNED,
    });
    prismaMock.orderAssignment.findUniqueOrThrow.mockResolvedValue({
      id: "assignment-1",
      orderId: "order-1",
      driverProfileId: "driver-profile-1",
      status: OrderAssignmentStatus.ASSIGNED,
      order: {
        id: "order-1",
        orderNumber: "KT-0001",
        status: OrderStatus.CONFIRMED,
        pickupAddress: null,
        dropoffAddress: null,
        deliveryRegion: null,
      },
      driverProfile: {
        user: { id: "driver-user-1", email: "driver@example.test", name: "Driver" },
        serviceRegions: [],
      },
      events: [],
    });
  });

  it("keeps assignment creation flow and writes admin activity", async () => {
    const result = await assignOrderToDriver("admin-1", "order-1", {
      driverProfileId: "driver-profile-1",
      adminNote: "Assign now.",
    });

    expect("error" in result).toBe(false);
    expect(assertOrderAssignableMock).toHaveBeenCalledWith("order-1");
    expect(createAssignmentInTxMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: "order-1",
        driverProfileId: "driver-profile-1",
        assignedByAdminId: "admin-1",
      })
    );
    expect(recordAdminActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        action: "CREATE",
        entityType: "OrderAssignment",
      })
    );
  });
});
