import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
  systemSetting: { findMany: vi.fn() },
  order: { findUnique: vi.fn() },
  orderAssignment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  driverProfile: { findUnique: vi.fn() },
  orderAssignmentEvent: { create: vi.fn() },
  orderOperationalEvent: { create: vi.fn() },
  adminActivityLog: { create: vi.fn() },
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
});
