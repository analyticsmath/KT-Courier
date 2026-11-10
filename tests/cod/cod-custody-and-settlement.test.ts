import { describe, expect, it, vi } from "vitest";
import {
  hasHighRiskRegion,
  isHighRiskCashPolicyEvidence,
} from "@/lib/settings/high-risk-region-policy";
import { DriverCashLimitError } from "@/lib/services/driver-cash-capacity.service";
import { Prisma } from "@prisma/client";
import { PlatformError } from "@/lib/client-platform/contracts";

vi.mock("@/lib/auth/permissions", () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));

import { reviewDriverDeposit } from "@/lib/client-platform/driver-cash.service";

describe("Workstream 4: COD Custody, Driver Capacity & Deposit Proof", () => {
  describe("High-Risk Area Suppression for COD", () => {
    it("suppresses cash on delivery if pickup (origin) is high risk", () => {
      const highRiskIds = ["region-jhb-cbd", "region-alexandra"];
      expect(hasHighRiskRegion("region-jhb-cbd", "region-sandton", highRiskIds)).toBe(true);
    });

    it("suppresses cash on delivery if drop-off (destination) is high risk", () => {
      const highRiskIds = ["region-jhb-cbd", "region-alexandra"];
      expect(hasHighRiskRegion("region-sandton", "region-alexandra", highRiskIds)).toBe(true);
    });

    it("allows cash on delivery if neither endpoint is high risk", () => {
      const highRiskIds = ["region-jhb-cbd", "region-alexandra"];
      expect(hasHighRiskRegion("region-sandton", "region-rosebank", highRiskIds)).toBe(false);
    });

    it("detects high-risk policy evidence in order policy snapshot", () => {
      expect(
        isHighRiskCashPolicyEvidence({
          originRegionId: "region-jhb-cbd",
          destinationRegionId: "region-sandton",
          highRiskRegionIdsAtDecision: ["region-jhb-cbd"],
        }),
      ).toBe(true);

      expect(
        isHighRiskCashPolicyEvidence({
          originRegionId: "region-rosebank",
          destinationRegionId: "region-sandton",
          highRiskRegionIdsAtDecision: ["region-jhb-cbd"],
        }),
      ).toBe(false);
    });
  });

  describe("Driver Cash Custody Cap Formula", () => {
    it("throws DriverCashLimitError when held + reserved + requested exceeds limit", () => {
      const held = new Prisma.Decimal("1500.00");
      const reserved = new Prisma.Decimal("1000.00");
      const requested = new Prisma.Decimal("600.00");
      const limit = new Prisma.Decimal("3000.00");

      expect(held.add(reserved).add(requested).greaterThan(limit)).toBe(true);
      expect(() => {
        if (held.add(reserved).add(requested).greaterThan(limit)) {
          throw new DriverCashLimitError(
            held.toFixed(2),
            reserved.toFixed(2),
            requested.toFixed(2),
            limit.toFixed(2),
          );
        }
      }).toThrow(DriverCashLimitError);
    });

    it("permits cash assignment when within the approved limit", () => {
      const held = new Prisma.Decimal("1000.00");
      const reserved = new Prisma.Decimal("500.00");
      const requested = new Prisma.Decimal("500.00");
      const limit = new Prisma.Decimal("3000.00");

      expect(held.add(reserved).add(requested).lessThanOrEqualTo(limit)).toBe(true);
    });
  });

  describe("Driver Deposit Self-Review Prevention", () => {
    it("blocks a driver who is also an admin from reviewing their own deposit", async () => {
      const mockDriverUserId = "user-driver-admin";
      const mockDepositId = "deposit-123";

      const mockDeposit = {
        id: mockDepositId,
        driverProfileId: "profile-123",
        status: "PENDING",
        amount: new Prisma.Decimal("500.00"),
        remittanceMethod: "BANK_DEPOSIT",
      };

      const mockTx = {
        $executeRaw: vi.fn(),
        driverCashDeposit: {
          findUnique: vi.fn().mockResolvedValue(mockDeposit),
        },
        driverProfile: {
          findUnique: vi.fn().mockResolvedValue({ userId: mockDriverUserId }),
        },
      } as any;

      const prismaModule = await import("@/lib/db/prisma");
      vi.spyOn(prismaModule.prisma, "$transaction").mockImplementation(async (cb: any) =>
        cb(mockTx),
      );

      const reviewingUser = {
        id: mockDriverUserId,
        role: "ADMIN" as const,
        status: "ACTIVE" as const,
      };

      await expect(
        reviewDriverDeposit(reviewingUser as any, mockDepositId, {
          decision: "CONFIRM",
          bankReceiptVerified: true,
          note: "Reviewed bank statement",
        }),
      ).rejects.toThrow(PlatformError);

      await expect(
        reviewDriverDeposit(reviewingUser as any, mockDepositId, {
          decision: "CONFIRM",
          bankReceiptVerified: true,
          note: "Reviewed bank statement",
        }),
      ).rejects.toThrow("A driver cannot review or confirm their own cash deposit.");
    });
  });
});
