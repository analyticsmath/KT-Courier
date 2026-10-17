import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
  systemSetting: { findMany: vi.fn() },
  order: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  orderStatusHistory: { create: vi.fn() },
  notificationOutbox: { create: vi.fn() },
  notificationEventIntent: { upsert: vi.fn().mockResolvedValue({}) },
  orderAssignment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  driverProfile: { findUnique: vi.fn() },
  orderAssignmentEvent: { create: vi.fn() },
  orderOperationalEvent: { create: vi.fn() },
  adminActivityLog: { create: vi.fn() },
  marketplaceStoreOrderDeliveryBridge: { findFirst: vi.fn(), update: vi.fn() },
  marketplaceStoreOrder: { findUnique: vi.fn() },
}));

const evidenceMocks = vi.hoisted(() => ({
  createDispatchCandidateEvaluationInTx: vi.fn(),
  selectDispatchCandidateInTx: vi.fn(),
  setDispatchCandidateDispositionForAssignmentInTx: vi.fn(),
}));

const complianceMocks = vi.hoisted(() => ({
  evaluateDispatchComplianceEvidence: vi.fn(),
}));

const eligibilityMocks = vi.hoisted(() => ({
  evaluateDriverEligibility: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/services/dispatch-candidate-evidence.service", () => evidenceMocks);
vi.mock("@/lib/services/vehicle-compliance.service", () => complianceMocks);
vi.mock("@/lib/dispatch/eligibility", () => eligibilityMocks);

import {
  DISPATCH_SYSTEM_ACTOR,
  acceptDispatchAssignment,
  offerAssignment,
  reconcileExpiredDispatchOffers,
} from "@/lib/services/dispatch-assignment.service";

describe("dispatch assignment system actor attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$queryRaw.mockResolvedValue([]);
    db.systemSetting.findMany.mockResolvedValue([
      { key: "dispatch.assignment_offer_ttl_minutes", value: "15" },
      { key: "dispatch.policy_version", value: "dispatch-v1" },
      { key: "dispatch.default_driver_capacity", value: "2" },
    ]);
    db.order.findUnique.mockResolvedValue({
      id: "ord-1",
      status: "CONFIRMED",
      deliveryRegionId: "reg-1",
    });
    db.orderAssignment.findMany.mockResolvedValue([]);
    db.orderAssignment.findFirst.mockResolvedValue(null);
    db.driverProfile.findUnique.mockResolvedValue({
      id: "drv-1",
      status: "ACTIVE",
      availability: "AVAILABLE",
      maxConcurrentAssignments: 2,
      serviceRegions: [{ deliveryRegionId: "reg-1" }],
      documents: [],
      vehicles: [],
      user: { role: "DRIVER", status: "ACTIVE" },
    });
    db.orderAssignment.count.mockResolvedValue(0);
    complianceMocks.evaluateDispatchComplianceEvidence.mockReturnValue({ eligible: true });
    eligibilityMocks.evaluateDriverEligibility.mockReturnValue({ eligible: true, reasons: [] });
    evidenceMocks.createDispatchCandidateEvaluationInTx.mockResolvedValue({ evaluationId: "eval-1" });
    evidenceMocks.selectDispatchCandidateInTx.mockResolvedValue({});
    db.orderAssignment.create.mockResolvedValue({
      id: "asgn-1",
      status: "ASSIGNED",
      version: 1,
      expiresAt: new Date(Date.now() + 900_000),
    });
    db.orderAssignmentEvent.create.mockResolvedValue({});
    db.orderOperationalEvent.create.mockResolvedValue({});
    db.adminActivityLog.create.mockResolvedValue({});
  });

  it("creates automated offer with typed system actor and skips admin activity log and human operational timeline", async () => {
    const result = await offerAssignment(
      {
        systemActor: DISPATCH_SYSTEM_ACTOR,
        policyReference: "dspauto_gov_1",
        dispatchOperationId: "op-test-1",
      },
      "ord-1",
      { driverProfileId: "drv-1" }
    );

    expect(result.id).toBe("asgn-1");

    // OrderAssignment should have assignedBySystemActor set, assignedByAdminId null
    expect(db.orderAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "ord-1",
          driverProfileId: "drv-1",
          assignedByAdminId: null,
          assignedBySystemActor: "SYSTEM:marketplace-dispatch",
          dispatchPolicyReference: "dspauto_gov_1",
          dispatchOperationId: "op-test-1",
        }),
      })
    );

    // OrderAssignmentEvent should have actorSystemIdentity set, actorUserId null
    expect(db.orderAssignmentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentId: "asgn-1",
          actorUserId: null,
          actorSystemIdentity: "SYSTEM:marketplace-dispatch",
          actorRole: "SYSTEM",
        }),
      })
    );

    // Neither adminActivityLog nor orderOperationalEvent should be written for automated offers
    expect(db.adminActivityLog.create).not.toHaveBeenCalled();
    expect(db.orderOperationalEvent.create).not.toHaveBeenCalled();
  });

  it("creates manual offer with human admin user and writes admin activity log and operational event", async () => {
    const result = await offerAssignment("admin-user-42", "ord-1", {
      driverProfileId: "drv-1",
      adminNote: "Manual priority assignment",
    });

    expect(result.id).toBe("asgn-1");

    expect(db.orderAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "ord-1",
          driverProfileId: "drv-1",
          assignedByAdminId: "admin-user-42",
          assignedBySystemActor: null,
          dispatchPolicyReference: null,
        }),
      })
    );

    expect(db.orderAssignmentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentId: "asgn-1",
          actorUserId: "admin-user-42",
          actorSystemIdentity: null,
          actorRole: "ADMIN",
        }),
      })
    );

    expect(db.adminActivityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "admin-user-42",
          entityType: "OrderAssignment",
          entityId: "asgn-1",
        }),
      })
    );

    expect(db.orderOperationalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "ord-1",
          actorUserId: "admin-user-42",
          actorRole: "ADMIN",
        }),
      })
    );
  });

  it("reconciles expired dispatch offers with DISPATCH_SYSTEM_ACTOR attribution", async () => {
    db.orderAssignment.findMany.mockResolvedValue([
      {
        id: "asgn-exp-1",
        orderId: "ord-1",
        driverProfileId: "drv-1",
        assignedByAdminId: "admin-old",
        assignedBySystemActor: null,
        version: 1,
      },
    ]);
    db.orderAssignment.updateMany.mockResolvedValue({ count: 1 });

    const outcome = await reconcileExpiredDispatchOffers(50);
    expect(outcome.expired).toBe(1);

    expect(db.orderAssignmentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentId: "asgn-exp-1",
          actorUserId: null,
          actorSystemIdentity: "SYSTEM:marketplace-dispatch",
          actorRole: "SYSTEM",
          eventType: "ASSIGNMENT_EXPIRED",
        }),
      })
    );

    expect(db.orderOperationalEvent.create).not.toHaveBeenCalled();
  });

  describe("acceptDispatchAssignment revalidation on driver acceptance", () => {
    const mockDriverProfile = {
      id: "drv-1",
      userId: "user-drv-1",
      status: "ACTIVE",
      availability: "AVAILABLE",
      maxConcurrentAssignments: 2,
      serviceRegions: [{ deliveryRegionId: "reg-1" }],
      documents: [],
      vehicles: [],
      user: { role: "DRIVER", status: "ACTIVE" },
    };

    const mockOrder = {
      id: "ord-1",
      orderNumber: "ORD-1",
      source: "MARKETPLACE",
      status: "CONFIRMED",
      deliveryRegionId: "reg-1",
    };

    const mockAssignment = {
      id: "asgn-1",
      orderId: "ord-1",
      driverProfileId: "drv-1",
      status: "ASSIGNED",
      version: 1,
      expiresAt: new Date(Date.now() + 60_000),
      order: mockOrder,
      driverProfile: mockDriverProfile,
    };

    beforeEach(() => {
      db.orderAssignment.findUnique.mockResolvedValue({
        orderId: "ord-1",
        driverProfileId: "drv-1",
      });
      db.orderAssignment.findUniqueOrThrow.mockResolvedValue(mockAssignment);
      db.orderAssignment.updateMany.mockResolvedValue({ count: 1 });
      db.order.update.mockResolvedValue({ ...mockOrder, status: "PICKUP_SCHEDULED" });
      db.order.findUniqueOrThrow.mockResolvedValue({ ...mockOrder, status: "PICKUP_SCHEDULED" });
      db.orderStatusHistory.create.mockResolvedValue({ id: "osh-1" });
      db.notificationOutbox.create.mockResolvedValue({ id: "notif-1" });
      db.$executeRaw.mockResolvedValue(1);
    });

    it("revokes offer and marks bridge manual-dispatch-required when store order has active cancellation request", async () => {
      db.marketplaceStoreOrderDeliveryBridge.findFirst.mockResolvedValue({
        id: "br-1",
        status: "DISPATCH_PENDING",
        marketplaceStoreOrderId: "so-1",
        dispatchEvidence: { consecutiveFailures: 0 },
        storeOrder: { id: "so-1" },
      });

      db.marketplaceStoreOrder.findUnique.mockResolvedValue({
        id: "so-1",
        status: "SETTLED",
        acceptanceStatus: "ACCEPTED",
        derivedStatus: "READY_FOR_PICKUP",
        preparationStatus: "READY_FOR_HANDOFF",
        resolutionStatus: "CLEAR",
        financialResolutionStatus: "UNCHANGED",
        checkoutStoreGroup: {
          id: "csg-1",
          paymentPlan: null, // Prepaid
        },
        cancellationRequests: [
          { id: "cr-1", status: "REQUESTED" },
        ],
      });

      await expect(
        acceptDispatchAssignment("drv-1", "asgn-1", { expectedVersion: 1 })
      ).rejects.toMatchObject({
        code: "DISPATCH_ORDER_NOT_ASSIGNABLE",
      });

      // Verification: offer was revoked with DISPATCH_SYSTEM_ACTOR
      expect(db.orderAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "asgn-1", status: "ASSIGNED", version: 1 },
          data: expect.objectContaining({
            status: "REVOKED",
            activeOrderGuard: null,
          }),
        })
      );

      expect(db.orderAssignmentEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignmentId: "asgn-1",
            actorSystemIdentity: "SYSTEM:marketplace-dispatch",
            actorRole: "SYSTEM",
            eventType: "ASSIGNMENT_REVOKED",
          }),
        })
      );

      // Verification: bridge was marked manualDispatchRequired: true
      expect(db.marketplaceStoreOrderDeliveryBridge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "br-1" },
          data: expect.objectContaining({
            dispatchEvidence: expect.objectContaining({
              manualDispatchRequired: true,
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              revokedOfferAssignmentId: "asgn-1",
            }),
          }),
        })
      );

      // Verification: order currentDriverProfileId was NOT set
      expect(db.order.update).not.toHaveBeenCalled();
    });

    it("revokes offer when prepaid store order commercial status is not SETTLED", async () => {
      db.marketplaceStoreOrderDeliveryBridge.findFirst.mockResolvedValue({
        id: "br-1",
        status: "DISPATCH_PENDING",
        marketplaceStoreOrderId: "so-1",
        dispatchEvidence: {},
        storeOrder: { id: "so-1" },
      });

      db.marketplaceStoreOrder.findUnique.mockResolvedValue({
        id: "so-1",
        status: "PENDING_SETTLEMENT", // Prepaid not settled!
        acceptanceStatus: "ACCEPTED",
        derivedStatus: "READY_FOR_PICKUP",
        preparationStatus: "READY_FOR_HANDOFF",
        resolutionStatus: "CLEAR",
        financialResolutionStatus: "UNCHANGED",
        checkoutStoreGroup: {
          id: "csg-1",
          paymentPlan: null,
        },
        cancellationRequests: [],
      });

      await expect(
        acceptDispatchAssignment("drv-1", "asgn-1", { expectedVersion: 1 })
      ).rejects.toMatchObject({
        code: "DISPATCH_ORDER_NOT_ASSIGNABLE",
      });

      expect(db.orderAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "asgn-1", status: "ASSIGNED", version: 1 },
          data: expect.objectContaining({
            status: "REVOKED",
            reasonCode: "STORE_ORDER_NOT_SETTLED",
          }),
        })
      );
    });

    it("accepts assignment for COD order with valid deposit policy in PENDING_SETTLEMENT", async () => {
      db.marketplaceStoreOrderDeliveryBridge.findFirst.mockResolvedValue({
        id: "br-1",
        status: "DISPATCH_PENDING",
        marketplaceStoreOrderId: "so-cod-1",
        dispatchEvidence: { manualDispatchRequired: false },
        storeOrder: { id: "so-cod-1" },
      });

      db.marketplaceStoreOrder.findUnique.mockResolvedValue({
        id: "so-cod-1",
        status: "PENDING_SETTLEMENT",
        acceptanceStatus: "ACCEPTED",
        derivedStatus: "READY_FOR_PICKUP",
        preparationStatus: "READY_FOR_HANDOFF",
        resolutionStatus: "CLEAR",
        financialResolutionStatus: "UNCHANGED",
        checkoutStoreGroup: {
          id: "csg-1",
          paymentPlan: {
            version: "marketplace-payment-v1",
            mode: "DEPOSIT_PLUS_COD",
            authoritativeTotal: "100.00",
            digitalRequired: "20.00",
            cashRequired: "80.00",
            policyId: "pol_cod_test_123",
            policyVersion: 1,
            policyEvidence: {},
          },
        },
        cancellationRequests: [],
      });

      db.$queryRaw.mockResolvedValue([
        {
          bridgeId: "br-1",
          storeOrderId: "so-cod-1",
          preparationStatus: "READY_FOR_HANDOFF",
          resolutionStatus: "CLEAR",
        },
      ]);

      const result = await acceptDispatchAssignment("drv-1", "asgn-1", { expectedVersion: 1 });
      expect(result).toBeDefined();

      expect(db.orderAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "asgn-1", status: "ASSIGNED", version: 1 },
          data: expect.objectContaining({
            status: "ACCEPTED",
          }),
        })
      );

      expect(db.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ord-1" },
          data: { currentDriverProfileId: "drv-1" },
        })
      );
    });

    it("returns existing assignment idempotently on replay without modifying assignment", async () => {
      const alreadyAcceptedAssignment = {
        ...mockAssignment,
        status: "ACCEPTED",
        version: 2,
      };
      db.orderAssignment.findUniqueOrThrow.mockResolvedValue(alreadyAcceptedAssignment);

      // Replay with original version
      const result = await acceptDispatchAssignment("drv-1", "asgn-1", { expectedVersion: 1 });
      expect(result.status).toBe("ACCEPTED");
      expect(result.version).toBe(2);

      // Replay with new accepted version
      const result2 = await acceptDispatchAssignment("drv-1", "asgn-1", { expectedVersion: 2 });
      expect(result2.status).toBe("ACCEPTED");

      // No new assignment updates on replay
      expect(db.orderAssignment.updateMany).not.toHaveBeenCalled();
    });
  });
});
