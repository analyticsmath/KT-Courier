import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  order: { findUnique: vi.fn() },
  marketplaceStoreOrderDeliveryBridge: { findFirst: vi.fn(), update: vi.fn() },
  orderAssignment: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));

import {
  isManualDispatchBlockerResolved,
  describeManualDispatchReason,
} from "@/lib/dispatch/automation-policy";
import { getAdminOrderDetail } from "@/lib/services/admin-orders.service";
import { resolveBridgeManualDispatchInTx } from "@/lib/services/dispatch-assignment.service";
import { OrderStatus } from "@/types/db";

describe("Manual Dispatch Warning Resolution and Blocker Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isManualDispatchBlockerResolved helper", () => {
    it("returns false for null/undefined or empty evidence", () => {
      expect(isManualDispatchBlockerResolved(null)).toBe(false);
      expect(isManualDispatchBlockerResolved(undefined)).toBe(false);
      expect(isManualDispatchBlockerResolved({})).toBe(false);
    });

    it("returns false when manualDispatchRequired is true and not resolved", () => {
      expect(isManualDispatchBlockerResolved({ manualDispatchRequired: true })).toBe(false);
      expect(isManualDispatchBlockerResolved({ dispatchRouting: "MANUAL_DISPATCH_REQUIRED" })).toBe(false);
    });

    it("returns true when manualDispatchRequired is explicitly false", () => {
      expect(isManualDispatchBlockerResolved({ manualDispatchRequired: false })).toBe(true);
    });

    it("returns true when manualDispatchResolvedAt timestamp is set", () => {
      expect(isManualDispatchBlockerResolved({ manualDispatchResolvedAt: "2026-10-17T06:00:00Z" })).toBe(true);
    });

    it("returns true when dispatchRouting is AUTOMATIC_OFFER_ACTIVE or ASSIGNED", () => {
      expect(isManualDispatchBlockerResolved({ dispatchRouting: "AUTOMATIC_OFFER_ACTIVE" })).toBe(true);
      expect(isManualDispatchBlockerResolved({ dispatchRouting: "ASSIGNED" })).toBe(true);
    });
  });

  describe("describeManualDispatchReason", () => {
    it("describes OFFER_CREATION_FAILED_RETRY_EXHAUSTED with actionable next steps", () => {
      const desc = describeManualDispatchReason("OFFER_CREATION_FAILED_RETRY_EXHAUSTED");
      expect(desc.code).toBe("OFFER_CREATION_FAILED_RETRY_EXHAUSTED");
      expect(desc.label).toContain("consecutive system errors");
      expect(desc.nextStep).toContain("Inspect offer creation error logs");
    });
  });

  describe("getAdminOrderDetail", () => {
    const baseOrder = {
      id: "ord-1",
      orderNumber: "KT-TEST-0001",
      deliveryType: "STANDARD",
      status: OrderStatus.CONFIRMED,
      source: "MARKETPLACE",
      parcelCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      pickupAddress: null,
      dropoffAddress: null,
      recipientName: "Test Recipient",
    };

    it("suppresses manual dispatch warning if order has an active assignment", async () => {
      db.order.findUnique.mockResolvedValue(baseOrder);
      db.marketplaceStoreOrderDeliveryBridge.findFirst.mockResolvedValue({
        id: "br-1",
        dispatchEvidence: {
          manualDispatchRequired: true,
          dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
          reason: "NO_ELIGIBLE_DRIVERS_AVAILABLE",
        },
      });
      // Active assignment exists
      db.orderAssignment.findFirst.mockResolvedValue({
        id: "assign-1",
        status: "ASSIGNED",
        driverProfileId: "drv-1",
      });

      const detail = await getAdminOrderDetail("ord-1");
      expect(detail).not.toBeNull();
      expect(detail?.manualDispatchRequired).toBeUndefined();
    });

    it("suppresses manual dispatch warning if blocker is already resolved in bridge evidence", async () => {
      db.order.findUnique.mockResolvedValue(baseOrder);
      db.marketplaceStoreOrderDeliveryBridge.findFirst.mockResolvedValue({
        id: "br-1",
        dispatchEvidence: {
          manualDispatchRequired: false,
          dispatchRouting: "AUTOMATIC_OFFER_ACTIVE",
          manualDispatchResolvedAt: "2026-10-17T06:30:00Z",
          reason: "AUTO_DISPATCH_DISABLED_BY_POLICY",
        },
      });
      db.orderAssignment.findFirst.mockResolvedValue(null);

      const detail = await getAdminOrderDetail("ord-1");
      expect(detail).not.toBeNull();
      expect(detail?.manualDispatchRequired).toBeUndefined();
    });

    it("renders manual dispatch warning if unassigned and blocker is active", async () => {
      db.order.findUnique.mockResolvedValue(baseOrder);
      db.marketplaceStoreOrderDeliveryBridge.findFirst.mockResolvedValue({
        id: "br-1",
        dispatchEvidence: {
          manualDispatchRequired: true,
          dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
          reason: "AUTO_DISPATCH_DISABLED_BY_POLICY",
        },
      });
      db.orderAssignment.findFirst.mockResolvedValue(null);

      const detail = await getAdminOrderDetail("ord-1");
      expect(detail).not.toBeNull();
      expect(detail?.manualDispatchRequired).toBe(true);
      expect(detail?.manualDispatchReason).toBe("AUTO_DISPATCH_DISABLED_BY_POLICY");
    });
  });

  describe("resolveBridgeManualDispatchInTx", () => {
    it("updates bridge evidence to clear manualDispatchRequired and append resolution history", async () => {
      const txMock = {
        marketplaceStoreOrderDeliveryBridge: {
          findFirst: vi.fn().mockResolvedValue({
            id: "br-1",
            dispatchEvidence: {
              manualDispatchRequired: true,
              reason: "NO_ELIGIBLE_DRIVERS_AVAILABLE",
              history: [{ event: "QUEUED_MANUAL", timestamp: "2026-10-17T05:00:00Z" }],
            },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      await resolveBridgeManualDispatchInTx(txMock as unknown as Parameters<typeof resolveBridgeManualDispatchInTx>[0], "ord-1", {
        actorUserId: "admin-1",
        assignmentId: "assign-1",
        driverProfileId: "drv-1",
        event: "MANUALLY_ASSIGNED",
        dispatchRouting: "ASSIGNED",
      });

      expect(txMock.marketplaceStoreOrderDeliveryBridge.update).toHaveBeenCalledWith({
        where: { id: "br-1" },
        data: {
          dispatchEvidence: expect.objectContaining({
            manualDispatchRequired: false,
            dispatchRouting: "ASSIGNED",
            manualDispatchResolvedAt: expect.any(String),
            consecutiveFailures: 0,
            history: expect.arrayContaining([
              expect.objectContaining({ event: "QUEUED_MANUAL" }),
              expect.objectContaining({
                event: "MANUALLY_ASSIGNED",
                actor: "ADMIN:admin-1",
                assignmentId: "assign-1",
                driverProfileId: "drv-1",
                previousReason: "NO_ELIGIBLE_DRIVERS_AVAILABLE",
              }),
            ]),
          }),
        },
      });
    });
  });
});
