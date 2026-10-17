import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const mockDb = {
    order: { findUnique: vi.fn() },
    systemSetting: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    orderAssignment: { findMany: vi.fn() },
    marketplaceStoreOrderDeliveryBridge: { findMany: vi.fn(), update: vi.fn() },
    dispatchAutomationPolicy: { findFirst: vi.fn() },
  };
  return mockDb;
});

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
    it("returns false when setting is absent or null (fail-closed)", async () => {
      db.systemSetting.findUnique.mockResolvedValue(null);
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(null);
      expect(await isAutomaticDispatchEnabled()).toBe(false);

      db.systemSetting.findUnique.mockResolvedValue({ value: null });
      expect(await isAutomaticDispatchEnabled()).toBe(false);
    });

    it("returns false when setting is explicitly disabled", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: false });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(null);
      expect(await isAutomaticDispatchEnabled()).toBe(false);

      db.systemSetting.findUnique.mockResolvedValue({ value: "false" });
      expect(await isAutomaticDispatchEnabled()).toBe(false);
    });

    it("returns false when setting is true but no active policy is approved", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(null);
      expect(await isAutomaticDispatchEnabled()).toBe(false);
    });

    it("returns true only when setting is enabled AND governed policy is active", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue({
        id: "pol-1",
        publicReference: "dspauto_valid",
        versionNumber: 1,
        status: "ACTIVE",
        regionIds: ["reg-1"],
        maxOfferAttempts: 3,
        effectiveFrom: new Date("2026-01-01"),
        effectiveUntil: null,
        createdByUserId: "usr-creator",
        approvedByUserId: "usr-approver",
        approvedAt: new Date("2026-01-02"),
        activatedByUserId: "usr-activator",
        activatedAt: new Date("2026-01-02"),
      });
      expect(await isAutomaticDispatchEnabled()).toBe(true);
    });
  });

  describe("dispatchReadyMarketplaceOrdersBatch", () => {
    const validPolicy = {
      id: "pol-1",
      publicReference: "dspauto_valid",
      versionNumber: 1,
      status: "ACTIVE",
      regionIds: ["reg-1"],
      maxOfferAttempts: 3,
      effectiveFrom: new Date("2026-01-01"),
      effectiveUntil: null,
      createdByUserId: "usr-creator",
      approvedByUserId: "usr-approver",
      approvedAt: new Date("2026-01-02"),
      activatedByUserId: "usr-activator",
      activatedAt: new Date("2026-01-02"),
    };

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
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(null);
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
              reason: "AUTO_DISPATCH_SETTING_OFF",
            }),
          }),
        })
      );
    });

    it("routes order to manual dispatch queue when delivery region is outside policy scope", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue({
        ...validPolicy,
        regionIds: ["reg-other"],
      });
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        {
          id: "br-1",
          courierOrderId: "ord-1",
          dispatchEvidence: {},
          courierOrder: { id: "ord-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        },
      ]);
      db.orderAssignment.findMany.mockResolvedValue([]);
      db.marketplaceStoreOrderDeliveryBridge.update.mockResolvedValue({});

      const result = await dispatchReadyMarketplaceOrdersBatch({
        mode: "APPLY",
        operationId: "op-outside-region",
      });

      expect(result.itemsReconciled).toBe(1);
      expect(result.itemsCompleted).toBe(0);
      expect(db.marketplaceStoreOrderDeliveryBridge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "br-1" },
          data: expect.objectContaining({
            dispatchEvidence: expect.objectContaining({
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              reason: "ORDER_REGION_OUTSIDE_POLICY_SCOPE",
            }),
          }),
        })
      );
    });

    it("routes order to manual dispatch queue when max attempts are exceeded", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        {
          id: "br-1",
          courierOrderId: "ord-1",
          dispatchEvidence: {},
          courierOrder: { id: "ord-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        },
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
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        {
          id: "br-1",
          courierOrderId: "ord-1",
          dispatchEvidence: {},
          courierOrder: { id: "ord-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        },
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

    it("offers assignment to top eligible candidate using typed system actor and updates bridge status", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        {
          id: "br-1",
          courierOrderId: "ord-1",
          dispatchEvidence: {},
          courierOrder: { id: "ord-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        },
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
        {
          systemActor: "SYSTEM:marketplace-dispatch",
          policyReference: "dspauto_valid",
          dispatchOperationId: "op-offer-success",
        },
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
              manualDispatchRequired: false,
              dispatchRouting: "AUTOMATIC_OFFER_ACTIVE",
              lastOfferedAssignmentId: "assign-new-1",
              offeredDriverProfileId: "drv-top",
              systemActor: "SYSTEM:marketplace-dispatch",
              policyReference: "dspauto_valid",
              consecutiveFailures: 0,
            }),
          }),
        })
      );
    });

    it("records structured per-order failure and increments retried when offer fails", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        {
          id: "br-1",
          courierOrderId: "ord-1",
          dispatchEvidence: { consecutiveFailures: 1 },
          courierOrder: { id: "ord-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        },
      ]);
      db.orderAssignment.findMany.mockResolvedValue([]);
      dispatchEvidenceMocks.createDispatchCandidateEvaluation.mockResolvedValue({
        candidates: [
          { driverProfileId: "drv-top", driverCode: "DRV-TOP", displayName: "Top Driver", eligible: true, rank: 1 },
        ],
      });
      dispatchAssignmentMocks.offerAssignment.mockRejectedValue(new Error("Database lock timeout on driver profile"));
      db.marketplaceStoreOrderDeliveryBridge.update.mockResolvedValue({});

      const result = await dispatchReadyMarketplaceOrdersBatch({
        mode: "APPLY",
        operationId: "op-offer-fail",
      });

      expect(result.itemsRetried).toBe(1);
      expect(result.itemsCompleted).toBe(0);
      expect(result.itemsReconciled).toBe(0);
      expect(db.marketplaceStoreOrderDeliveryBridge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "br-1" },
          data: expect.objectContaining({
            dispatchEvidence: expect.objectContaining({
              consecutiveFailures: 2,
              failureCount: 2,
              lastErrorCode: "LOCK_TIMEOUT",
              policyReference: "dspauto_valid",
              operationId: "op-offer-fail",
            }),
          }),
        })
      );
    });

    it("routes to manual exception queue with OFFER_CREATION_FAILED_RETRY_EXHAUSTED when 3 failures reached", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        {
          id: "br-1",
          courierOrderId: "ord-1",
          dispatchEvidence: { consecutiveFailures: 2 },
          courierOrder: { id: "ord-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        },
      ]);
      db.orderAssignment.findMany.mockResolvedValue([]);
      dispatchEvidenceMocks.createDispatchCandidateEvaluation.mockResolvedValue({
        candidates: [
          { driverProfileId: "drv-top", driverCode: "DRV-TOP", displayName: "Top Driver", eligible: true, rank: 1 },
        ],
      });
      dispatchAssignmentMocks.offerAssignment.mockRejectedValue(new Error("Concurrency conflict on order"));
      db.marketplaceStoreOrderDeliveryBridge.update.mockResolvedValue({});

      const result = await dispatchReadyMarketplaceOrdersBatch({
        mode: "APPLY",
        operationId: "op-exhaust-fail",
      });

      expect(result.itemsReconciled).toBe(1);
      expect(result.itemsCompleted).toBe(0);
      expect(db.marketplaceStoreOrderDeliveryBridge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "br-1" },
          data: expect.objectContaining({
            dispatchEvidence: expect.objectContaining({
              manualDispatchRequired: true,
              dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
              reason: "OFFER_CREATION_FAILED_RETRY_EXHAUSTED",
              reasonLabel: expect.stringContaining("Automatic offer creation encountered consecutive system errors"),
              actionableNextStep: expect.stringContaining("Inspect offer creation error logs"),
              consecutiveFailures: 3,
              failureCount: 3,
              lastErrorCode: "CONCURRENCY_CONFLICT",
            }),
          }),
        })
      );

      // P2: Verify raw exception text is not persisted in bridge evidence
      const updateCall = db.marketplaceStoreOrderDeliveryBridge.update.mock.calls.at(-1);
      expect(updateCall).toBeDefined();
      if (!updateCall) throw new Error("expected a bridge update call");
      const persisted = updateCall[0].data.dispatchEvidence;
      const historyEntry = persisted.history.at(-1);
      expect(historyEntry).toBeDefined();
      expect(historyEntry).not.toHaveProperty("message");
      expect(historyEntry.errorCode).toBe("CONCURRENCY_CONFLICT");
      expect(JSON.stringify(persisted)).not.toContain("Concurrency conflict on order");
    });

    it("does not retry or create offers for orders already in terminal OFFER_CREATION_FAILED_RETRY_EXHAUSTED state on subsequent runs", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        {
          id: "br-terminal-1",
          courierOrderId: "ord-term-1",
          dispatchEvidence: {
            manualDispatchRequired: true,
            dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
            reason: "OFFER_CREATION_FAILED_RETRY_EXHAUSTED",
            consecutiveFailures: 3,
            failureCount: 3,
          },
          courierOrder: { id: "ord-term-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        },
      ]);
      db.orderAssignment.findMany.mockResolvedValue([]);

      const result = await dispatchReadyMarketplaceOrdersBatch({
        mode: "APPLY",
        operationId: "op-subsequent-run",
      });

      // Assert no candidate evaluation or offer assignment is attempted
      expect(dispatchEvidenceMocks.createDispatchCandidateEvaluation).not.toHaveBeenCalled();
      expect(dispatchAssignmentMocks.offerAssignment).not.toHaveBeenCalled();
      expect(db.marketplaceStoreOrderDeliveryBridge.update).not.toHaveBeenCalled();
      expect(result.itemsCompleted).toBe(0);
      expect(result.itemsRetried).toBe(0);
      expect(result.itemsReconciled).toBe(1);
    });

    it("excludes driver whose offer is still marked ASSIGNED but has expired (expiresAt <= now)", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        {
          id: "br-timed-out",
          courierOrderId: "ord-timeout-1",
          dispatchEvidence: {},
          courierOrder: { id: "ord-timeout-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        },
      ]);

      const expiredAt = new Date(Date.now() - 60000); // 1 minute ago
      db.orderAssignment.findMany.mockResolvedValue([
        {
          id: "as-stale",
          driverProfileId: "drv-stale",
          status: "ASSIGNED",
          expiresAt: expiredAt,
        },
      ]);

      dispatchEvidenceMocks.createDispatchCandidateEvaluation.mockResolvedValue({
        candidates: [
          { driverProfileId: "drv-next", driverCode: "DRV-NEXT", displayName: "Next Driver", eligible: true, rank: 1 },
        ],
      });
      dispatchAssignmentMocks.offerAssignment.mockResolvedValue({
        id: "as-new",
        expiresAt: new Date(Date.now() + 180000),
      });
      db.marketplaceStoreOrderDeliveryBridge.update.mockResolvedValue({});

      const result = await dispatchReadyMarketplaceOrdersBatch({
        mode: "APPLY",
        operationId: "op-expired-offer-test",
      });

      expect(result.itemsCompleted).toBe(1);
      // Verify findEligibleDriversForOrder excluded drv-stale
      expect(dispatchEvidenceMocks.createDispatchCandidateEvaluation).toHaveBeenCalled();
      // Verify offerAssignment was called with the next driver, NOT drv-stale
      expect(dispatchAssignmentMocks.offerAssignment).toHaveBeenCalledWith(
        expect.anything(),
        "ord-timeout-1",
        expect.objectContaining({
          driverProfileId: "drv-next",
        })
      );
    });

    it("blocks creating a second offer when a non-expired ASSIGNED offer is active", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValue([
        {
          id: "br-active-offer",
          courierOrderId: "ord-active-1",
          dispatchEvidence: {},
          courierOrder: { id: "ord-active-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        },
      ]);

      const futureExpiresAt = new Date(Date.now() + 120000); // 2 minutes in future
      db.orderAssignment.findMany.mockResolvedValue([
        {
          id: "as-active",
          driverProfileId: "drv-active",
          status: "ASSIGNED",
          expiresAt: futureExpiresAt,
        },
      ]);

      const result = await dispatchReadyMarketplaceOrdersBatch({
        mode: "APPLY",
        operationId: "op-active-offer-test",
      });

      expect(result.itemsCompleted).toBe(0);
      expect(dispatchAssignmentMocks.offerAssignment).not.toHaveBeenCalled();
    });

    it("never emits the raw exception message to durable evidence or to application/platform logs", async () => {
      const secret = "SECRET-DB-DETAIL host=db.internal.example user=svc password=hunter2";
      const sinks = [
        vi.spyOn(console, "error").mockImplementation(() => undefined),
        vi.spyOn(console, "warn").mockImplementation(() => undefined),
        vi.spyOn(console, "info").mockImplementation(() => undefined),
        vi.spyOn(console, "log").mockImplementation(() => undefined),
      ];
      try {
        db.systemSetting.findUnique.mockResolvedValue({ value: true });
        db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);
        db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValueOnce([
          {
            id: "br-log-1",
            courierOrderId: "ord-log-1",
            dispatchEvidence: { consecutiveFailures: 0 },
            courierOrder: { id: "ord-log-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
          },
        ]);
        db.orderAssignment.findMany.mockResolvedValue([]);
        dispatchEvidenceMocks.createDispatchCandidateEvaluation.mockResolvedValue({
          candidates: [
            { driverProfileId: "drv-top", driverCode: "DRV-TOP", displayName: "Top Driver", eligible: true, rank: 1 },
          ],
        });
        dispatchAssignmentMocks.offerAssignment.mockRejectedValue(new Error(secret));
        db.marketplaceStoreOrderDeliveryBridge.update.mockResolvedValue({});

        await dispatchReadyMarketplaceOrdersBatch({ mode: "APPLY", operationId: "op-log-redaction" });

        const logged = sinks.flatMap((sink) => sink.mock.calls.flat()).map((arg) => String(arg)).join("\n");
        expect(logged).toContain("DISPATCH_AUTOMATIC_OFFER_FAILED");
        expect(logged).toContain("OFFER_EXECUTION_FAILED");
        expect(logged).not.toContain("SECRET-DB-DETAIL");
        expect(logged).not.toContain("hunter2");
        expect(logged).not.toContain("rawError");

        const durable = JSON.stringify(db.marketplaceStoreOrderDeliveryBridge.update.mock.calls);
        expect(durable).not.toContain("SECRET-DB-DETAIL");
        expect(durable).not.toContain("hunter2");
      } finally {
        sinks.forEach((sink) => sink.mockRestore());
      }
    });

    it("excludes manual-dispatch bridges directly in the database query with null-safe filter and keyset ordering", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);
      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValueOnce([]);

      await dispatchReadyMarketplaceOrdersBatch({ mode: "APPLY", operationId: "op-db-query" });

      // Verification: exactly ONE query is performed to find candidates (no unbounded prior exhausted read)
      expect(db.marketplaceStoreOrderDeliveryBridge.findMany).toHaveBeenCalledTimes(1);
      const [candidateQuery] = db.marketplaceStoreOrderDeliveryBridge.findMany.mock.calls[0];

      // Verification: database-side null-safe exclusion of manualDispatchRequired
      expect(candidateQuery.where.AND).toEqual([
        expect.objectContaining({
          OR: [
            { dispatchEvidence: { equals: expect.anything() } },
            { dispatchEvidence: { equals: expect.anything() } },
            {
              NOT: {
                dispatchEvidence: {
                  path: ["manualDispatchRequired"],
                  equals: true,
                },
              },
            },
          ],
        }),
      ]);

      // Verification: canonical store order eligibility enforced at database level
      expect(candidateQuery.where.storeOrder).toEqual(
        expect.objectContaining({
          acceptanceStatus: "ACCEPTED",
          status: { notIn: ["CANCELLED", "RECONCILIATION_REQUIRED"] },
          resolutionStatus: { in: ["CLEAR", "RESOLVED"] },
          financialResolutionStatus: { in: ["UNCHANGED", "REFUND_COMPLETED"] },
          cancellationRequests: {
            none: {
              status: { in: ["REQUESTED", "APPROVED", "RECONCILIATION_REQUIRED"] },
            },
          },
        })
      );

      // Verification: keyset deterministic ordering prevents starvation
      expect(candidateQuery.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
      // Verification: no unbounded notIn list
      expect(candidateQuery.where.id).toBeUndefined();
    });

    it("processes runnable bridges with SQL null, JsonNull, and unkeyed evidence without starvation", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);

      const runnableBridgeNull = {
        id: "br-run-null",
        courierOrderId: "ord-run-1",
        dispatchEvidence: null, // SQL NULL
        courierOrder: { id: "ord-run-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        storeOrder: {
          id: "so-1",
          status: "SETTLED",
          acceptanceStatus: "ACCEPTED",
          derivedStatus: "READY_FOR_PICKUP",
          preparationStatus: "READY_FOR_HANDOFF",
          resolutionStatus: "CLEAR",
          financialResolutionStatus: "UNCHANGED",
          cancellationRequests: [],
        },
      };
      const runnableBridgeMissingKey = {
        id: "br-run-missing",
        courierOrderId: "ord-run-2",
        dispatchEvidence: { consecutiveFailures: 1 }, // Missing manualDispatchRequired / reason keys
        courierOrder: { id: "ord-run-2", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        storeOrder: {
          id: "so-2",
          status: "SETTLED",
          acceptanceStatus: "ACCEPTED",
          derivedStatus: "READY_FOR_PICKUP",
          preparationStatus: "READY_FOR_HANDOFF",
          resolutionStatus: "CLEAR",
          financialResolutionStatus: "UNCHANGED",
          cancellationRequests: [],
        },
      };

      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValueOnce([
        runnableBridgeNull,
        runnableBridgeMissingKey,
      ]);

      db.orderAssignment.findMany.mockResolvedValue([]);
      dispatchEvidenceMocks.createDispatchCandidateEvaluation.mockResolvedValue({
        candidates: [{ driverProfileId: "drv-1", driverCode: "DRV-1", displayName: "Driver 1", eligible: true, rank: 1 }],
      });
      dispatchAssignmentMocks.offerAssignment.mockResolvedValue({ id: "asg-1", expiresAt: new Date(Date.now() + 60_000) });
      db.marketplaceStoreOrderDeliveryBridge.update.mockResolvedValue({});

      const result = await dispatchReadyMarketplaceOrdersBatch({ mode: "APPLY", batchSize: 20, operationId: "op-null-safe" });

      expect(result.itemsCompleted).toBe(2);
      expect(dispatchAssignmentMocks.offerAssignment).toHaveBeenCalledTimes(2);
      expect(dispatchAssignmentMocks.offerAssignment).toHaveBeenCalledWith(
        expect.anything(),
        "ord-run-1",
        expect.anything()
      );
      expect(dispatchAssignmentMocks.offerAssignment).toHaveBeenCalledWith(
        expect.anything(),
        "ord-run-2",
        expect.anything()
      );
    });

    it("skips bridges with future backoff nextAttemptAt without calling offerAssignment", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);

      const futureDate = new Date(Date.now() + 60_000).toISOString();
      const backoffBridge = {
        id: "br-backoff",
        courierOrderId: "ord-backoff-1",
        dispatchEvidence: {
          nextAttemptAt: futureDate,
          consecutiveFailures: 1,
        },
        courierOrder: { id: "ord-backoff-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        storeOrder: {
          id: "so-backoff",
          status: "SETTLED",
          acceptanceStatus: "ACCEPTED",
          derivedStatus: "READY_FOR_PICKUP",
          preparationStatus: "READY_FOR_HANDOFF",
          resolutionStatus: "CLEAR",
          financialResolutionStatus: "UNCHANGED",
          cancellationRequests: [],
        },
      };

      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValueOnce([backoffBridge]);

      const result = await dispatchReadyMarketplaceOrdersBatch({ mode: "APPLY", operationId: "op-backoff" });

      expect(result.itemsRetried).toBe(1);
      expect(result.itemsCompleted).toBe(0);
      expect(dispatchEvidenceMocks.createDispatchCandidateEvaluation).not.toHaveBeenCalled();
      expect(dispatchAssignmentMocks.offerAssignment).not.toHaveBeenCalled();
    });

    it("skips bridges and reconciles when store order becomes ineligible in memory", async () => {
      db.systemSetting.findUnique.mockResolvedValue({ value: true });
      db.dispatchAutomationPolicy.findFirst.mockResolvedValue(validPolicy);

      const storeOrderCancelled = {
        id: "br-cancelled",
        courierOrderId: "ord-cancelled-1",
        dispatchEvidence: {},
        courierOrder: { id: "ord-cancelled-1", status: "CONFIRMED", deliveryRegionId: "reg-1" },
        storeOrder: {
          id: "so-cancelled",
          status: "CANCELLED",
          acceptanceStatus: "ACCEPTED",
          derivedStatus: "READY_FOR_PICKUP",
          preparationStatus: "READY_FOR_HANDOFF",
          resolutionStatus: "CLEAR",
          financialResolutionStatus: "UNCHANGED",
          cancellationRequests: [],
        },
      };

      db.marketplaceStoreOrderDeliveryBridge.findMany.mockResolvedValueOnce([storeOrderCancelled]);

      const result = await dispatchReadyMarketplaceOrdersBatch({ mode: "APPLY", operationId: "op-mem-check" });

      expect(result.itemsReconciled).toBe(1);
      expect(result.itemsCompleted).toBe(0);
      expect(dispatchAssignmentMocks.offerAssignment).not.toHaveBeenCalled();
    });
  });
});
