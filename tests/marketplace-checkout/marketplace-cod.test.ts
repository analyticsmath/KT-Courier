import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const mockPrisma = vi.hoisted(() => ({
  paymentMethodPolicy: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

import {
  resolvePaymentBreakdown,
  PaymentPolicyError,
} from "@/lib/payments/payment-policy.service";

describe("Phase 1 Acceptance: Marketplace Cash-On-Delivery (COD) & Breakdown Policy", () => {
  const basePolicy = {
    id: "pol-1",
    versionNumber: 1,
    status: "ACTIVE",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    businessModuleId: null,
    storeId: null,
    deliveryServiceId: null,
    orderType: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("FULL_COD Mode", () => {
    it("allocates 0 to digital and full total to cashRequired", async () => {
      mockPrisma.paymentMethodPolicy.findMany.mockResolvedValueOnce([
        {
          ...basePolicy,
          mode: "FULL_COD",
          maximumCodAmount: new Prisma.Decimal("1000.00"),
          depositAmount: null,
          depositPercent: null,
        },
      ]);

      const result = await resolvePaymentBreakdown({
        authoritativeTotal: "450.00",
      });

      expect(result.mode).toBe("FULL_COD");
      expect(result.authoritativeTotal).toBe("450.00");
      expect(result.digitalRequired).toBe("0.00");
      expect(result.cashRequired).toBe("450.00");
      expect(result.cashOutstanding).toBe("450.00");
    });
  });

  describe("DEPOSIT_PLUS_COD Mode", () => {
    it("calculates fixed deposit amount correctly", async () => {
      mockPrisma.paymentMethodPolicy.findMany.mockResolvedValueOnce([
        {
          ...basePolicy,
          mode: "DEPOSIT_PLUS_COD",
          maximumCodAmount: new Prisma.Decimal("2000.00"),
          depositAmount: new Prisma.Decimal("100.00"),
          depositPercent: null,
        },
      ]);

      const result = await resolvePaymentBreakdown({
        authoritativeTotal: "500.00",
      });

      expect(result.mode).toBe("DEPOSIT_PLUS_COD");
      expect(result.authoritativeTotal).toBe("500.00");
      expect(result.digitalRequired).toBe("100.00");
      expect(result.cashRequired).toBe("400.00");
      expect(result.cashOutstanding).toBe("400.00");
    });

    it("calculates percentage deposit correctly with half-up rounding", async () => {
      mockPrisma.paymentMethodPolicy.findMany.mockResolvedValueOnce([
        {
          ...basePolicy,
          mode: "DEPOSIT_PLUS_COD",
          maximumCodAmount: new Prisma.Decimal("5000.00"),
          depositAmount: null,
          depositPercent: new Prisma.Decimal("0.20"), // 20%
        },
      ]);

      const result = await resolvePaymentBreakdown({
        authoritativeTotal: "350.00",
      });

      expect(result.mode).toBe("DEPOSIT_PLUS_COD");
      expect(result.authoritativeTotal).toBe("350.00");
      expect(result.digitalRequired).toBe("70.00"); // 20% of 350
      expect(result.cashRequired).toBe("280.00");
    });
  });

  describe("COD Threshold Ceiling Enforcement", () => {
    it("fails closed when order total exceeds maximumCodAmount", async () => {
      mockPrisma.paymentMethodPolicy.findMany.mockResolvedValue([
        {
          ...basePolicy,
          mode: "FULL_COD",
          maximumCodAmount: new Prisma.Decimal("500.00"),
          depositAmount: null,
          depositPercent: null,
        },
      ]);

      await expect(
        resolvePaymentBreakdown({
          authoritativeTotal: "500.01", // Exceeds 500 limit
        }),
      ).rejects.toMatchObject({ code: "COD_LIMIT_EXCEEDED" });
    });
  });

  describe("DIGITAL_ONLY Mode", () => {
    it("requires 100% digital payment and 0 cash", async () => {
      mockPrisma.paymentMethodPolicy.findMany.mockResolvedValueOnce([
        {
          ...basePolicy,
          mode: "DIGITAL",
          maximumCodAmount: null,
          depositAmount: null,
          depositPercent: null,
        },
      ]);

      const result = await resolvePaymentBreakdown({
        authoritativeTotal: "899.99",
      });

      expect(result.mode).toBe("DIGITAL_ONLY");
      expect(result.authoritativeTotal).toBe("899.99");
      expect(result.digitalRequired).toBe("899.99");
      expect(result.cashRequired).toBe("0.00");
      expect(result.cashOutstanding).toBe("0.00");
    });
  });

  describe("Invalid Input Guard", () => {
    it("rejects negative totals or already-paid exceeding total", async () => {
      await expect(
        resolvePaymentBreakdown({
          authoritativeTotal: "-10.00",
        }),
      ).rejects.toThrow(PaymentPolicyError);

      await expect(
        resolvePaymentBreakdown({
          authoritativeTotal: "100.00",
          digitalAlreadyPaid: "150.00", // Exceeds total
        }),
      ).rejects.toThrow(PaymentPolicyError);
    });
  });
});
