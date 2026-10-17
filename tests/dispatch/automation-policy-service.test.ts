import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  deliveryRegion: { count: vi.fn() },
  dispatchAutomationPolicy: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  adminActivityLog: { create: vi.fn() },
  $transaction: vi.fn((callback) => callback(db)),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));

import {
  createDispatchAutomationPolicyDraft,
  submitDispatchAutomationPolicy,
  approveDispatchAutomationPolicy,
  rejectDispatchAutomationPolicy,
  activateDispatchAutomationPolicy,
  retireDispatchAutomationPolicy,
  DispatchPolicyError,
} from "@/lib/dispatch/automation-policy.service";

describe("Dispatch Automation Policy Service — Governance, Maker/Checker & Audit", () => {
  const activeAdminUser = { id: "admin-author", role: "ADMIN", status: "ACTIVE" };
  const independentAdminUser = { id: "admin-approver", role: "ADMIN", status: "ACTIVE" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assertActiveAdminActor", () => {
    it("rejects policy draft creation if actor is not an active administrator", async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(
        createDispatchAutomationPolicyDraft({
          versionNumber: 1,
          regionIds: ["reg-1"],
          maxOfferAttempts: 3,
          effectiveFrom: new Date(),
          createdByUserId: "unauthorized-user",
        })
      ).rejects.toThrowError(DispatchPolicyError);

      expect(db.dispatchAutomationPolicy.create).not.toHaveBeenCalled();
    });
  });

  describe("createDispatchAutomationPolicyDraft", () => {
    it("creates draft policy and records adminActivityLog when author is active admin", async () => {
      db.user.findFirst.mockResolvedValue(activeAdminUser);
      db.deliveryRegion.count.mockResolvedValue(1);
      const mockCreated = {
        id: "pol-1",
        publicReference: "dspauto_test1",
        versionNumber: 1,
        status: "DRAFT",
        regionIds: ["reg-1"],
        maxOfferAttempts: 3,
      };
      db.dispatchAutomationPolicy.create.mockResolvedValue(mockCreated);
      db.adminActivityLog.create.mockResolvedValue({});

      const result = await createDispatchAutomationPolicyDraft({
        versionNumber: 1,
        regionIds: ["reg-1"],
        maxOfferAttempts: 3,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        createdByUserId: "admin-author",
      });

      expect(result.id).toBe("pol-1");
      expect(db.dispatchAutomationPolicy.create).toHaveBeenCalled();
      expect(db.adminActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorUserId: "admin-author",
            action: "CREATE",
            entityType: "DispatchAutomationPolicy",
            entityId: "pol-1",
          }),
        })
      );
    });
  });

  describe("submitDispatchAutomationPolicy", () => {
    it("transitions draft policy to UNDER_REVIEW and logs activity", async () => {
      db.user.findFirst.mockResolvedValue(activeAdminUser);
      db.dispatchAutomationPolicy.findUnique.mockResolvedValue({
        id: "pol-1",
        publicReference: "dspauto_test1",
        versionNumber: 1,
        status: "DRAFT",
        createdByUserId: "admin-author",
      });
      db.dispatchAutomationPolicy.updateMany.mockResolvedValue({ count: 1 });
      db.dispatchAutomationPolicy.findUniqueOrThrow.mockResolvedValue({
        id: "pol-1",
        publicReference: "dspauto_test1",
        versionNumber: 1,
        status: "UNDER_REVIEW",
      });
      db.adminActivityLog.create.mockResolvedValue({});

      const result = await submitDispatchAutomationPolicy("dspauto_test1", "admin-author");

      expect(result.status).toBe("UNDER_REVIEW");
      expect(db.adminActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorUserId: "admin-author",
            action: "STATUS_CHANGE",
            entityType: "DispatchAutomationPolicy",
          }),
        })
      );
    });
  });

  describe("approveDispatchAutomationPolicy & maker/checker", () => {
    it("blocks author self-approval under maker/checker rule", async () => {
      db.user.findFirst.mockResolvedValue(activeAdminUser);
      db.dispatchAutomationPolicy.findUnique.mockResolvedValue({
        id: "pol-1",
        publicReference: "dspauto_test1",
        versionNumber: 1,
        status: "UNDER_REVIEW",
        createdByUserId: "admin-author",
      });

      await expect(
        approveDispatchAutomationPolicy({
          publicReference: "dspauto_test1",
          approvedByUserId: "admin-author",
        })
      ).rejects.toThrowError(/author/);

      expect(db.dispatchAutomationPolicy.updateMany).not.toHaveBeenCalled();
    });

    it("approves policy when approved by independent administrator", async () => {
      db.user.findFirst.mockResolvedValue(independentAdminUser);
      db.dispatchAutomationPolicy.findUnique.mockResolvedValue({
        id: "pol-1",
        publicReference: "dspauto_test1",
        versionNumber: 1,
        status: "UNDER_REVIEW",
        createdByUserId: "admin-author",
      });
      db.dispatchAutomationPolicy.updateMany.mockResolvedValue({ count: 1 });
      db.dispatchAutomationPolicy.findUniqueOrThrow.mockResolvedValue({
        id: "pol-1",
        publicReference: "dspauto_test1",
        versionNumber: 1,
        status: "APPROVED",
        approvedByUserId: "admin-approver",
      });
      db.adminActivityLog.create.mockResolvedValue({});

      const result = await approveDispatchAutomationPolicy({
        publicReference: "dspauto_test1",
        approvedByUserId: "admin-approver",
      });

      expect(result.status).toBe("APPROVED");
      expect(db.adminActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorUserId: "admin-approver",
            action: "STATUS_CHANGE",
            entityType: "DispatchAutomationPolicy",
          }),
        })
      );
    });
  });

  describe("rejectDispatchAutomationPolicy", () => {
    it("rejects policy with structured reason code and records audit", async () => {
      db.user.findFirst.mockResolvedValue(independentAdminUser);
      db.dispatchAutomationPolicy.findUnique.mockResolvedValue({
        id: "pol-1",
        publicReference: "dspauto_test1",
        versionNumber: 1,
        status: "UNDER_REVIEW",
        createdByUserId: "admin-author",
      });
      db.dispatchAutomationPolicy.updateMany.mockResolvedValue({ count: 1 });
      db.dispatchAutomationPolicy.findUniqueOrThrow.mockResolvedValue({
        id: "pol-1",
        status: "REJECTED",
        rejectionReasonCode: "INSUFFICIENT_REGION_CAPACITY",
      });
      db.adminActivityLog.create.mockResolvedValue({});

      const result = await rejectDispatchAutomationPolicy({
        publicReference: "dspauto_test1",
        rejectedByUserId: "admin-approver",
        reasonCode: "INSUFFICIENT_REGION_CAPACITY",
      });

      expect(result.status).toBe("REJECTED");
      expect(db.adminActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorUserId: "admin-approver",
            action: "STATUS_CHANGE",
            entityType: "DispatchAutomationPolicy",
          }),
        })
      );
    });
  });

  describe("activateDispatchAutomationPolicy", () => {
    it("retires previous active policy and activates candidate", async () => {
      db.user.findFirst.mockResolvedValue(independentAdminUser);
      db.dispatchAutomationPolicy.findUnique.mockResolvedValue({
        id: "pol-2",
        publicReference: "dspauto_cand",
        versionNumber: 2,
        status: "APPROVED",
        approvedByUserId: "admin-approver",
        approvedAt: new Date(),
      });
      db.dispatchAutomationPolicy.findMany.mockResolvedValue([
        { id: "pol-1", publicReference: "dspauto_old", versionNumber: 1, status: "ACTIVE" },
      ]);
      db.dispatchAutomationPolicy.updateMany.mockResolvedValue({ count: 1 });
      db.dispatchAutomationPolicy.update.mockResolvedValue({
        id: "pol-2",
        publicReference: "dspauto_cand",
        versionNumber: 2,
        status: "ACTIVE",
        activatedByUserId: "admin-approver",
      });
      db.adminActivityLog.create.mockResolvedValue({});

      const result = await activateDispatchAutomationPolicy({
        publicReference: "dspauto_cand",
        activatedByUserId: "admin-approver",
      });

      expect(result.status).toBe("ACTIVE");
      expect(db.dispatchAutomationPolicy.updateMany).toHaveBeenCalledWith({
        where: { status: "ACTIVE" },
        data: expect.objectContaining({ status: "RETIRED" }),
      });
      expect(db.adminActivityLog.create).toHaveBeenCalledTimes(2); // 1 for retiring old, 1 for activating new
    });
  });

  describe("retireDispatchAutomationPolicy", () => {
    it("retires an active policy and logs audit", async () => {
      db.user.findFirst.mockResolvedValue(activeAdminUser);
      db.dispatchAutomationPolicy.findUnique.mockResolvedValue({
        id: "pol-1",
        publicReference: "dspauto_test1",
        versionNumber: 1,
        status: "ACTIVE",
      });
      db.dispatchAutomationPolicy.updateMany.mockResolvedValue({ count: 1 });
      db.dispatchAutomationPolicy.findUniqueOrThrow.mockResolvedValue({
        id: "pol-1",
        status: "RETIRED",
      });
      db.adminActivityLog.create.mockResolvedValue({});

      const result = await retireDispatchAutomationPolicy({
        publicReference: "dspauto_test1",
        retiredByUserId: "admin-author",
      });

      expect(result.status).toBe("RETIRED");
      expect(db.adminActivityLog.create).toHaveBeenCalled();
    });
  });
});
