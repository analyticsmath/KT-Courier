import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { adjustCustomerLoyaltyPoints } from "@/lib/rewards/customer-loyalty-admin.service";
import { checkFirstStoreWelcomeEligibility } from "@/lib/promotions/first-store-welcome.service";
import {
  evaluatePromotionsReleaseGate,
  assertPromotionsProductionReady,
  PromotionsProductionLockedError,
} from "@/lib/promotions/production-lock";

describe("Workstream 3: Loyalty & Promotions Business Logic", () => {
  describe("Admin Loyalty Points Adjustment Logic", () => {
    it("validates input fields strictly", async () => {
      await expect(
        adjustCustomerLoyaltyPoints({
          customerUserId: "",
          deltaPoints: 100n,
          reason: "Bonus points",
          actorUserId: "admin-1",
        }),
      ).rejects.toThrow(/required/i);

      await expect(
        adjustCustomerLoyaltyPoints({
          customerUserId: "cust-1",
          deltaPoints: 0n,
          reason: "Bonus points",
          actorUserId: "admin-1",
        }),
      ).rejects.toThrow(/nonzero/i);

      await expect(
        adjustCustomerLoyaltyPoints({
          customerUserId: "cust-1",
          deltaPoints: 50n,
          reason: "tiny",
          actorUserId: "admin-1",
        }),
      ).rejects.toThrow(/at least 5 characters/i);
    });

    it("adds points and repays existing debt atomically", async () => {
      let currentAccount = {
        userId: "cust-1",
        availablePoints: 0n,
        debtPoints: 30n,
        lifetimeEarnedPoints: 100n,
        lifetimeReversedPoints: 50n,
        version: 1,
      };

      const mockTx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "cust-1",
            role: "CUSTOMER",
            status: "ACTIVE",
          }),
        },
        customerLoyaltyAccount: {
          findUnique: vi.fn().mockImplementation(() => Promise.resolve(currentAccount)),
          create: vi.fn(),
          update: vi.fn().mockImplementation(({ data }) => {
            currentAccount = {
              ...currentAccount,
              ...data,
              version: currentAccount.version + (data.version?.increment ?? 1),
            };
            return Promise.resolve(currentAccount);
          }),
        },
        adminActivityLog: {
          create: vi.fn().mockResolvedValue({ id: "log-1" }),
        },
      } as unknown as Prisma.TransactionClient;

      vi.spyOn(mockTx.customerLoyaltyAccount, "update");

      // Mock prisma transaction
      const prismaModule = await import("@/lib/db/prisma");
      vi.spyOn(prismaModule.prisma, "$transaction").mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(mockTx),
      );

      // Add 100 points: 30 repays debt, 70 goes to available
      const result = await adjustCustomerLoyaltyPoints({
        customerUserId: "cust-1",
        deltaPoints: 100n,
        reason: "Customer goodwill credit",
        actorUserId: "admin-1",
      });

      expect(result.availablePoints).toBe("70");
      expect(result.debtPoints).toBe("0");
      expect(result.lifetimeEarnedPoints).toBe("200");
    });

    it("deducts points into debt when available balance is insufficient", async () => {
      let currentAccount = {
        userId: "cust-2",
        availablePoints: 20n,
        debtPoints: 0n,
        lifetimeEarnedPoints: 50n,
        lifetimeReversedPoints: 0n,
        version: 1,
      };

      const mockTx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "cust-2",
            role: "CUSTOMER",
            status: "ACTIVE",
          }),
        },
        customerLoyaltyAccount: {
          findUnique: vi.fn().mockImplementation(() => Promise.resolve(currentAccount)),
          create: vi.fn(),
          update: vi.fn().mockImplementation(({ data }) => {
            currentAccount = {
              ...currentAccount,
              ...data,
              version: currentAccount.version + (data.version?.increment ?? 1),
            };
            return Promise.resolve(currentAccount);
          }),
        },
        adminActivityLog: {
          create: vi.fn().mockResolvedValue({ id: "log-2" }),
        },
      } as unknown as Prisma.TransactionClient;

      const prismaModule = await import("@/lib/db/prisma");
      vi.spyOn(prismaModule.prisma, "$transaction").mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(mockTx),
      );

      // Deduct 50 points when only 20 available -> 0 available, 30 debt
      const result = await adjustCustomerLoyaltyPoints({
        customerUserId: "cust-2",
        deltaPoints: -50n,
        reason: "Points adjustment clawback",
        actorUserId: "admin-1",
      });

      expect(result.availablePoints).toBe("0");
      expect(result.debtPoints).toBe("30");
      expect(result.lifetimeReversedPoints).toBe("50");
    });
  });

  describe("First Store Welcome Offer Policy", () => {
    const mockSettingRows = [
      { key: "loyalty.points_per_zar", type: "NUMBER", value: 1 },
      { key: "loyalty.conversion_points", type: "NUMBER", value: 100 },
      { key: "loyalty.conversion_wallet_zar", type: "NUMBER", value: 2 },
      { key: "referral.reward_zar", type: "NUMBER", value: 5 },
      { key: "welcome.store.discount_zar", type: "NUMBER", value: 50 },
      { key: "welcome.store.valid_days", type: "NUMBER", value: 7 },
      { key: "welcome.store.minimum_order_zar", type: "NUMBER", value: 0 },
    ];

    it("identifies eligible customer within 7 days of signup and 0 orders", async () => {
      const now = new Date("2026-11-10T12:00:00Z");
      const createdAt = new Date("2026-11-05T12:00:00Z"); // 5 days ago

      const mockDb = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "user-new",
            role: "CUSTOMER",
            status: "ACTIVE",
            createdAt,
          }),
        },
        systemSetting: {
          findMany: vi.fn().mockResolvedValue(mockSettingRows),
        },
        marketplaceOrder: {
          count: vi.fn().mockResolvedValue(0),
        },
        promotionRedemption: {
          count: vi.fn().mockResolvedValue(0),
        },
        marketplaceCheckout: {
          count: vi.fn().mockResolvedValue(0),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await checkFirstStoreWelcomeEligibility("user-new", "100.00", now, mockDb);
      expect(res.eligible).toBe(true);
      expect(res.discountAmountZar).toBe("50.00");
    });

    it("rejects welcome offer after 7 days window expires", async () => {
      const now = new Date("2026-11-10T12:00:00Z");
      const createdAt = new Date("2026-10-20T12:00:00Z"); // 21 days ago

      const mockDb = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "user-old",
            role: "CUSTOMER",
            status: "ACTIVE",
            createdAt,
          }),
        },
        systemSetting: {
          findMany: vi.fn().mockResolvedValue(mockSettingRows),
        },
        marketplaceOrder: {
          count: vi.fn().mockResolvedValue(0),
        },
        promotionRedemption: {
          count: vi.fn().mockResolvedValue(0),
        },
        marketplaceCheckout: {
          count: vi.fn().mockResolvedValue(0),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await checkFirstStoreWelcomeEligibility("user-old", "100.00", now, mockDb);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe("WELCOME_OFFER_EXPIRED");
    });

    it("rejects welcome offer if customer has already completed a store order", async () => {
      const now = new Date("2026-11-10T12:00:00Z");
      const createdAt = new Date("2026-11-08T12:00:00Z"); // 2 days ago

      const mockDb = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "user-repeat",
            role: "CUSTOMER",
            status: "ACTIVE",
            createdAt,
          }),
        },
        systemSetting: {
          findMany: vi.fn().mockResolvedValue(mockSettingRows),
        },
        marketplaceOrder: {
          count: vi.fn().mockResolvedValue(1),
        },
        promotionRedemption: {
          count: vi.fn().mockResolvedValue(0),
        },
        marketplaceCheckout: {
          count: vi.fn().mockResolvedValue(0),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await checkFirstStoreWelcomeEligibility("user-repeat", "100.00", now, mockDb);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe("NOT_FIRST_ORDER");
    });

    it("denies award with POLICY_UNAVAILABLE when policy settings cannot be loaded", async () => {
      const now = new Date("2026-11-10T12:00:00Z");
      const createdAt = new Date("2026-11-08T12:00:00Z");

      const mockDb = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "user-new",
            role: "CUSTOMER",
            status: "ACTIVE",
            createdAt,
          }),
        },
        systemSetting: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await checkFirstStoreWelcomeEligibility("user-new", "100.00", now, mockDb);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe("POLICY_UNAVAILABLE");
    });

    it("denies award when customer has an active held checkout reservation", async () => {
      const now = new Date("2026-11-10T12:00:00Z");
      const createdAt = new Date("2026-11-08T12:00:00Z");

      const mockDb = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "user-held",
            role: "CUSTOMER",
            status: "ACTIVE",
            createdAt,
          }),
        },
        systemSetting: {
          findMany: vi.fn().mockResolvedValue(mockSettingRows),
        },
        marketplaceOrder: {
          count: vi.fn().mockResolvedValue(0),
        },
        promotionRedemption: {
          count: vi.fn().mockResolvedValue(0),
        },
        marketplaceCheckout: {
          count: vi.fn().mockResolvedValue(1),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await checkFirstStoreWelcomeEligibility("user-held", "100.00", now, mockDb);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe("WELCOME_OFFER_ALREADY_RESERVED");
    });

    it("denies award for guest users and inactive customer status", async () => {
      const resGuest = await checkFirstStoreWelcomeEligibility("", "100.00");
      expect(resGuest.eligible).toBe(false);
      expect(resGuest.reason).toBe("GUEST_NOT_ELIGIBLE");

      const mockDb = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "user-suspended",
            role: "CUSTOMER",
            status: "SUSPENDED",
            createdAt: new Date(),
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const resSuspended = await checkFirstStoreWelcomeEligibility("user-suspended", "100.00", new Date(), mockDb);
      expect(resSuspended.eligible).toBe(false);
      expect(resSuspended.reason).toBe("CUSTOMER_NOT_ELIGIBLE");
    });

    it("allows typed injected policy dependencies without querying system settings", async () => {
      const now = new Date("2026-11-10T12:00:00Z");
      const createdAt = new Date("2026-11-08T12:00:00Z");

      const mockDb = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "user-injected",
            role: "CUSTOMER",
            status: "ACTIVE",
            createdAt,
          }),
        },
        marketplaceOrder: { count: vi.fn().mockResolvedValue(0) },
        promotionRedemption: { count: vi.fn().mockResolvedValue(0) },
        marketplaceCheckout: { count: vi.fn().mockResolvedValue(0) },
      } as unknown as Prisma.TransactionClient;

      const res = await checkFirstStoreWelcomeEligibility(
        "user-injected",
        "100.00",
        now,
        mockDb,
        undefined,
        {
          policy: {
            pointsPerZar: 1,
            conversionPoints: 100,
            conversionWalletZar: "2.00",
            referralRewardZar: "5.00",
            firstStoreDiscountZar: "50.00",
            firstStoreValidDays: 7,
            firstStoreMinimumZar: "0.00",
          },
        },
      );
      expect(res.eligible).toBe(true);
      expect(res.discountAmountZar).toBe("50.00");
    });
  });

  describe("Promotions Release Gate", () => {
    it("fails closed in production environment without external approval", () => {
      const gate = evaluatePromotionsReleaseGate({
        NODE_ENV: "production",
      });
      expect(gate.approved).toBe(false);
      expect(gate.reason).toBe("CONSOLIDATED_VALIDATION_NOT_APPROVED");

      expect(() =>
        assertPromotionsProductionReady("CAMPAIGN_ACTIVATE", undefined, {
          NODE_ENV: "production",
        }),
      ).toThrow(PromotionsProductionLockedError);
    });

    it("allows operations in isolated test environments", () => {
      const gate = evaluatePromotionsReleaseGate({
        NODE_ENV: "test",
      });
      expect(gate.approved).toBe(true);
      expect(gate.reason).toBeNull();

      expect(() =>
        assertPromotionsProductionReady("EVALUATION", undefined, {
          NODE_ENV: "test",
        }),
      ).not.toThrow();
    });
  });
});
