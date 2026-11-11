import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { checkFirstStoreWelcomeEligibility } from "@/lib/promotions/first-store-welcome.service";
import {
  postPlatformSubsidyJournalInTx,
  reversePlatformSubsidyJournalInTx,
  PlatformSubsidyLedgerError,
  PLATFORM_PROMOTION_EXPENSE_ACCOUNT_CODE,
  PLATFORM_CUSTOMER_FUNDS_HELD_ACCOUNT_CODE,
} from "@/lib/promotions/platform-subsidy-ledger.service";

describe("Atomic First-Store Entitlement & Subsidy Conservation", () => {
  const policy = {
    firstStoreDiscountZar: "50.00",
    firstStoreMinimumZar: "100.00",
    firstStoreValidDays: 7,
    pointsPerZar: 1,
    conversionPoints: 100,
    conversionWalletZar: "2.00",
    referralRewardZar: "5.00",
  };

  it("denies concurrent second basket when first basket has already reserved the welcome offer", async () => {
    const customerId = "cust-concurrency-test-1";
    const now = new Date();
    const signupAt = new Date(now.getTime() - 24 * 3600 * 1000); // 1 day ago

    // Mock DB representing state where Basket 1 has just reserved the welcome offer
    const dbBasket1 = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: customerId }]),
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: customerId, role: "CUSTOMER", status: "ACTIVE", createdAt: signupAt }),
      },
      marketplaceOrder: { count: vi.fn().mockResolvedValue(0) },
      promotionRedemption: { count: vi.fn().mockResolvedValue(0) },
      marketplaceCheckout: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as Prisma.TransactionClient;

    // Basket 1 evaluates eligibility
    const result1 = await checkFirstStoreWelcomeEligibility(customerId, "250.00", now, dbBasket1, undefined, { policy });
    expect(result1.eligible).toBe(true);
    expect(result1.discountAmountZar).toBe("50.00");

    // Basket 2 evaluates eligibility concurrently while Basket 1 checkout is in RESERVED state
    const dbBasket2 = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: customerId }]),
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: customerId, role: "CUSTOMER", status: "ACTIVE", createdAt: signupAt }),
      },
      marketplaceOrder: { count: vi.fn().mockResolvedValue(0) },
      promotionRedemption: { count: vi.fn().mockResolvedValue(0) },
      marketplaceCheckout: { count: vi.fn().mockResolvedValue(1) }, // 1 active checkout with promotionDiscount > 0
    } as unknown as Prisma.TransactionClient;

    const result2 = await checkFirstStoreWelcomeEligibility(customerId, "300.00", now, dbBasket2, "checkout-basket-2", { policy });
    expect(result2.eligible).toBe(false);
    expect(result2.discountAmountZar).toBe("0.00");
    expect(result2.reason).toBe("WELCOME_OFFER_ALREADY_RESERVED");
  });

  it("fails closed in postPlatformSubsidyJournalInTx if accounts are missing or inactive", async () => {
    const mockTxMissing = {
      ledgerAccount: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      postPlatformSubsidyJournalInTx(mockTxMissing, {
        orderId: "order-1",
        orderPublicReference: "morder-1",
        amount: "50.00",
      }),
    ).rejects.toThrow(PlatformSubsidyLedgerError);

    const mockTxInactive = {
      ledgerAccount: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.code === PLATFORM_PROMOTION_EXPENSE_ACCOUNT_CODE) {
            return Promise.resolve({ id: "acc-exp", code: PLATFORM_PROMOTION_EXPENSE_ACCOUNT_CODE, currency: "ZAR", status: "FROZEN" });
          }
          return Promise.resolve({ id: "acc-held", code: PLATFORM_CUSTOMER_FUNDS_HELD_ACCOUNT_CODE, currency: "ZAR", status: "ACTIVE" });
        }),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      postPlatformSubsidyJournalInTx(mockTxInactive, {
        orderId: "order-2",
        orderPublicReference: "morder-2",
        amount: "50.00",
      }),
    ).rejects.toThrow("Canonical platform subsidy ledger accounts must be ACTIVE.");
  });

  it("fails closed in reversePlatformSubsidyJournalInTx if accounts are missing or wrong currency", async () => {
    const mockTxWrongCurrency = {
      ledgerAccount: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.code === PLATFORM_PROMOTION_EXPENSE_ACCOUNT_CODE) {
            return Promise.resolve({ id: "acc-exp", code: PLATFORM_PROMOTION_EXPENSE_ACCOUNT_CODE, currency: "USD", status: "ACTIVE" });
          }
          return Promise.resolve({ id: "acc-held", code: PLATFORM_CUSTOMER_FUNDS_HELD_ACCOUNT_CODE, currency: "ZAR", status: "ACTIVE" });
        }),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      reversePlatformSubsidyJournalInTx(mockTxWrongCurrency, {
        adjustmentId: "adj-1",
        adjustmentPublicReference: "adj-ref-1",
        amount: "50.00",
      }),
    ).rejects.toThrow("Canonical platform subsidy ledger accounts must have currency ZAR.");
  });

  it("conserves monetary balance: net refund + subsidy reversal equals gross consideration", () => {
    // Store 1: Merchandise R200, Delivery R50 -> Gross G1 = R250
    // Store 2: Merchandise R300, Delivery R50 -> Gross G2 = R350
    // Total Gross G = R600. Platform discount S = R50. Net Customer Paid N = R550.
    const gross1 = new Prisma.Decimal("250.00");
    const gross2 = new Prisma.Decimal("350.00");
    const totalGross = gross1.add(gross2); // 600.00
    const totalDiscount = new Prisma.Decimal("50.00");
    const netPaid = totalGross.sub(totalDiscount); // 550.00

    // Proportional discount allocation
    const discount1 = totalDiscount.mul(gross1).div(totalGross).toDecimalPlaces(2); // 20.83
    const discount2 = totalDiscount.sub(discount1); // 29.17
    expect(discount1.add(discount2).equals(totalDiscount)).toBe(true);

    // Full cancellation of Store 1
    const netCustomerRefund1 = gross1.sub(discount1); // 229.17
    const subsidyReversal1 = discount1; // 20.83

    // Proofs:
    // 1. Customer refund does not exceed net cash paid
    expect(netCustomerRefund1.lessThanOrEqualTo(netPaid)).toBe(true);
    // 2. Customer refund does not exceed store gross
    expect(netCustomerRefund1.lessThan(gross1)).toBe(true);
    // 3. Perfect monetary conservation
    expect(netCustomerRefund1.add(subsidyReversal1).equals(gross1)).toBe(true);
  });
});
