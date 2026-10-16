import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  order: { findUnique: vi.fn() },
  systemSetting: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findFirst: vi.fn() },
  orderAssignment: { findMany: vi.fn() },
  marketplaceStoreOrderDeliveryBridge: { findMany: vi.fn(), update: vi.fn() },
}));

const dispatchEvidenceMocks = vi.hoisted(() => ({
  createDispatchCandidateEvaluation: vi.fn(),
}));

const dispatchAssignmentMocks = vi.hoisted(() => ({
  offerAssignment: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/services/dispatch-candidate-evidence.service", () => dispatchEvidenceMocks);
vi.mock("@/lib/services/dispatch-assignment.service", () => dispatchAssignmentMocks);

import {
  scheduleMarketplaceDispatchEligibility,
  findEligibleDriversForOrder,
  isAutomaticDispatchEnabled,
  dispatchReadyMarketplaceOrdersBatch,
} from "@/lib/services/marketplace-dispatch-eligibility.service";

describe("Marketplace Dispatch Eligibility and Automated Dispatch Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scheduleMarketplaceDispatchEligibility", () => {
    it("throws if order is not found or not in eligible status", async () => {
      db.order.findUnique.mockResolvedValue(null);
      await expect(
        scheduleMarketplaceDispatchEligibility({
          courierOrderId: "ord-1",
          storeOrderReference: "so-ref-1",
          expectedReadyAt: new Date(),
          deliveryQuoteReference: "quote-1",
          operationId: "op-1",
        })
      ).rejects.toThrowError(/not eligible for Phase 7/);
    });

    it("schedules eligibility evidence for confirmed order", async () => {
      db.order.findUnique.mockResolvedValue({
        id: "ord-1",
        status: "CONFIRMED",
        deliveryRegionId: "reg-1",
        scheduledFor: null,
      });

      const result = await scheduleMarketplaceDispatchEligibility({
        courierOrderId: "ord-1",
        storeOrderReference: "so-ref-1",
        expectedReadyAt: new Date("2026-10-17T10:00:00Z"),
        deliveryQuoteReference: "quote-1",
        operationId: "op-1",
      });

      expect(result.phase).toBe("PHASE_7_DISPATCH_ELIGIBILITY");
      expect(result.driverSelected).toBe(false);
      expect(result.courierOrderId).toBe("ord-1");
    });
  });

  describe("findEligibleDriversForOrder", () => {
    it("returns eligible candidates sorted by deterministic rank", async () => {
      dispatchEvidenceMocks.createDispatchCandidateEvaluation.mockResolvedValue({
        candidates: [
          { driverProfileId: "drv-2", driverCode: "DRV-2", displayName: "Driver 2", eligible: true, rank: 2 },
          { driverProfileId: "drv-1", driverCode: "DRV-1", displayName: "Driver 1", eligible: true, rank: 1 },
          { driverProfileId: "drv-3", driverCode: "DRV-3", displayName: "Driver 3", eligible: false, rank: 3 },
        ],
      });

      const drivers = await findEligibleDriversForOrder("ord-1", { operationId: "op-find" });
      expect(drivers).toHaveLength(2);
      expect(drivers[0].driverProfileId).toBe("drv-1");
      expect(drivers[1].driverProfileId).toBe("drv-2");
    });

    it("excludes drivers provided in exclusion list", async () => {
      dispatchEvidenceMocks.createDispatchCandidateEvaluation.mockResolvedValue({
        candidates: [
          { driverProfileId: "drv-1", driverCode: "DRV-1", displayName: "Driver 1", eligible: true, rank: 1 },
          { driverProfileId: "drv-2", driverCode: "DRV-2", displayName: "Driver 2", eligible: true, rank: 2 },
        ],
      });

      const drivers = await findEligibleDriversForOrder("ord-1", {
        excludeDriverProfileIds: ["drv-1"],
      });
      expect(drivers).toHaveLength(1);
      expect(drivers[0].driverProfileId).toBe("drv-2");
    });
  });

  describe("isAutomaticDispatchEnabled", () => {
    it("returns true when setting is absent or enabled", async () => {
      db.systemSetting.findUnique.mockResolvedValue(null);
      expect(await isAutomaticDispatchEnabled()).toBe(true);

      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      expect(await isAutomaticDispatchEnabled()).toBe(true);

      db.systemSetting.findUnique.mockResolvedValue({ value: "true" });
      expect(await isAutomaticDispatchEnabled()).toBe(true);
    });

    it("returns false when setting is explicitly disabled", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: false });
      expect(await isAutomaticDispatchEnabled()).toBe(false);

      db.systemSetting.findUnique.mockResolvedValue({ value: "false" });
      expect(await isAutomaticDispatchEnabled()).toBe(false);
    });
  });

  describe("dispatchReadyMarketplaceOrdersBatch", () => {
    it("summarizes pending items in DRY_RUN mode without updates", async () => {
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        { id: "br-1", courierOrderId: "ord-1" },
        { id: "br-2", courierOrderId: "ord-2" },
      ]);

      const result = await dispatchReadyMarketplaceOrdersBatch({
        mode: "DRY_RUN",
        operationId: "op-dry",
      });

      expect(result.itemsExamined).toBe(2);
      expect(result.itemsCompleted).toBe(0);
      expect(result.safeSummary).toContain("[DRY_RUN]");
      expect(db.marketplaceStoreOrderDeliveryBridge.update).not.toHaveBeenCalled();
    });

    it("routes orders to manual dispatch queue when automatic dispatch is disabled by policy", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: false });
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        { id: "br-1", courierOrderId: "ord-1", dispatchEvidence: {} },
      ]);
      db.marketplaceStoreOrderDeliveryBridge.update.mockResolvedValue({});

      const result = await dispatchReadyMarketplaceOrdersBatch({
        mode: "APPLY",
        operationId: "op-disabled",
      });

      expect(result.itemsExamined).toBe(1);
      expect(result.itemsReconciled).toBe(1);
      expect(db.marketplaceStoreOrderDeliveryBridge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "br-1" },
          data: expect.objectContaining({
            dispatchEvidence: expect.objectContaining({
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              policyGate: "AUTO_DISPATCH_DISABLED_BY_POLICY",
            }),
          }),
        })
      );
    });

    it("routes order to manual dispatch queue when max attempts are exceeded", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.user.findFirst.mockResolvedValue({ id: "admin-1" });
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        { id: "br-1", courierOrderId: "ord-1", dispatchEvidence: {} },
      ]);
      db.orderAssignment.findMany.mockResolvedValue([
        { id: "as-1", driverProfileId: "drv-1", status: "REJECTED" },
        { id: "as-2", driverProfileId: "drv-2", status: "EXPIRED" },
        { id: "as-3", driverProfileId: "drv-3", status: "REJECTED" },
      ]);
      db.marketplaceStoreOrderDeliveryBridge.update.mockResolvedValue({});

      const result = await dispatchReadyMarketplaceOrdersBatch({
        mode: "APPLY",
        operationId: "op-max-attempts",
      });

      expect(result.itemsReconciled).toBe(1);
      expect(result.itemsCompleted).toBe(0);
      expect(db.marketplaceStoreOrderDeliveryBridge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "br-1" },
          data: expect.objectContaining({
            dispatchEvidence: expect.objectContaining({
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              reason: "MAX_OFFER_ATTEMPTS_EXCEEDED",
            }),
          }),
        })
      );
    });

    it("routes order to manual dispatch queue when no drivers are available", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.user.findFirst.mockResolvedValue({ id: "admin-1" });
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        { id: "br-1", courierOrderId: "ord-1", dispatchEvidence: {} },
      ]);
      db.orderAssignment.findMany.mockResolvedValue([]);
      dispatchEvidenceMocks.createDispatchCandidateEvaluation.mockResolvedValue({
        candidates: [],
      });
      db.marketplaceStoreOrderDeliveryBridge.update.mockResolvedValue({});

      const result = await dispatchReadyMarketplaceOrdersBatch({
        mode: "APPLY",
        operationId: "op-no-drivers",
      });

      expect(result.itemsReconciled).toBe(1);
      expect(result.itemsCompleted).toBe(0);
      expect(db.marketplaceStoreOrderDeliveryBridge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "br-1" },
          data: expect.objectContaining({
            dispatchEvidence: expect.objectContaining({
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              reason: "NO_ELIGIBLE_DRIVERS_AVAILABLE",
            }),
          }),
        })
      );
    });

    it("offers assignment to top eligible candidate and updates bridge status", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.user.findFirst.mockResolvedValue({ id: "admin-1" });
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        { id: "br-1", courierOrderId: "ord-1", dispatchEvidence: {} },
      ]);
      db.orderAssignment.findMany.mockResolvedValue([]);
      dispatchEvidenceMocks.createDispatchCandidateEvaluation.mockResolvedValue({
        candidates: [
          { driverProfileId: "drv-top", driverCode: "DRV-TOP", displayName: "Top Driver", eligible: true, rank: 1 },
        ],
      });
      dispatchAssignmentMocks.offerAssignment.mockResolvedValue({
        id: "assign-new-1",
        expiresAt: new Date(Date.now() + 600_000),
      });
      db.marketplaceStoreOrderDeliveryBridge.update.mockResolvedValue({});

      const result = await dispatchReadyMarketplaceOrdersBatch({
        mode: "APPLY",
        operationId: "op-offer-success",
      });

      expect(result.itemsCompleted).toBe(1);
      expect(dispatchAssignmentMocks.offerAssignment).toHaveBeenCalledWith(
        "admin-1",
        "ord-1",
        expect.objectContaining({
          driverProfileId: "drv-top",
          reasonCode: "AUTOMATIC_DISPATCH_OFFER",
        })
      );
      expect(db.marketplaceStoreOrderDeliveryBridge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "br-1" },
          data: expect.objectContaining({
            status: "DISPATCH_PENDING",
            dispatchEvidence: expect.objectContaining({
              lastOfferedAssignmentId: "assign-new-1",
              offeredDriverProfileId: "drv-top",
            }),
          }),
        })
      );
    });
  });
});
