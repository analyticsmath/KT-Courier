import { describe, expect, it, vi } from "vitest";
import {
  resolveWalletSpendBreakdown,
  newPublicPaymentReference,
} from "@/lib/services/wallet-spending.service";
import { PaymentError } from "@/lib/payments/errors";
import {
  resolveWithdrawalOwnerForUser,
  assertWithdrawalOwnerEligibility,
} from "@/lib/withdrawals/withdrawal-owner-policy";
import { WithdrawalError } from "@/lib/withdrawals/errors";

describe("Wallet Spending Logic (Phase 2)", () => {
  describe("resolveWalletSpendBreakdown", () => {
    it("handles zero wallet spend (PROVIDER_ONLY)", () => {
      const breakdown = resolveWalletSpendBreakdown({
        payableAmount: "150.00",
        availableBalance: "200.00",
        requestedWalletAmount: null,
      });

      expect(breakdown).toEqual({
        payableAmount: "150.00",
        walletAmount: "0.00",
        remainingProviderAmount: "150.00",
        mode: "PROVIDER_ONLY",
      });
    });

    it("handles full wallet spend (WALLET_ONLY)", () => {
      const breakdown = resolveWalletSpendBreakdown({
        payableAmount: "150.00",
        availableBalance: "200.00",
        requestedWalletAmount: "150.00",
      });

      expect(breakdown).toEqual({
        payableAmount: "150.00",
        walletAmount: "150.00",
        remainingProviderAmount: "0.00",
        mode: "WALLET_ONLY",
      });
    });

    it("handles split wallet spend (SPLIT_PAYSTACK)", () => {
      const breakdown = resolveWalletSpendBreakdown({
        payableAmount: "150.00",
        availableBalance: "200.00",
        requestedWalletAmount: "50.00",
      });

      expect(breakdown).toEqual({
        payableAmount: "150.00",
        walletAmount: "50.00",
        remainingProviderAmount: "100.00",
        mode: "SPLIT_PAYSTACK",
      });
    });

    it("rejects non-positive payable amounts", () => {
      expect(() =>
        resolveWalletSpendBreakdown({
          payableAmount: "0.00",
          availableBalance: "100.00",
          requestedWalletAmount: "0.00",
        }),
      ).toThrow(PaymentError);

      expect(() =>
        resolveWalletSpendBreakdown({
          payableAmount: "-10.00",
          availableBalance: "100.00",
          requestedWalletAmount: "0.00",
        }),
      ).toThrow(PaymentError);
    });

    it("rejects invalid wallet format", () => {
      expect(() =>
        resolveWalletSpendBreakdown({
          payableAmount: "100.00",
          availableBalance: "100.00",
          requestedWalletAmount: "abc",
        }),
      ).toThrow(PaymentError);

      expect(() =>
        resolveWalletSpendBreakdown({
          payableAmount: "100.00",
          availableBalance: "100.00",
          requestedWalletAmount: "-50.00",
        }),
      ).toThrow(PaymentError);
    });

    it("rejects wallet amount exceeding available balance", () => {
      expect(() =>
        resolveWalletSpendBreakdown({
          payableAmount: "150.00",
          availableBalance: "40.00",
          requestedWalletAmount: "50.00",
        }),
      ).toThrow(PaymentError);
    });

    it("rejects wallet amount exceeding payable amount", () => {
      expect(() =>
        resolveWalletSpendBreakdown({
          payableAmount: "50.00",
          availableBalance: "200.00",
          requestedWalletAmount: "80.00",
        }),
      ).toThrow(PaymentError);
    });
  });

  describe("newPublicPaymentReference", () => {
    it("generates a pay_ prefixed base64url reference", () => {
      const ref = newPublicPaymentReference();
      expect(ref.startsWith("pay_")).toBe(true);
      expect(ref.length).toBeGreaterThan(20);
    });
  });

  describe("Customer Cash Withdrawal Prohibition", () => {
    it("strictly blocks customer users from initiating cash withdrawals", async () => {
      const mockTx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "user-cust-123",
            status: "ACTIVE",
            role: "CUSTOMER",
          }),
        },
        store: { findFirst: vi.fn().mockResolvedValue(null) },
        driverProfile: { findUnique: vi.fn().mockResolvedValue(null) },
        promoterAccount: { findUnique: vi.fn().mockResolvedValue(null) },
      } as any;

      await expect(
        resolveWithdrawalOwnerForUser(mockTx, "user-cust-123"),
      ).rejects.toThrow(WithdrawalError);

      await expect(
        resolveWithdrawalOwnerForUser(mockTx, "user-cust-123"),
      ).rejects.toThrow("This account has no supported withdrawal ownership relationship.");
    });

    it("rejects suspended or inactive owners", () => {
      expect(() =>
        assertWithdrawalOwnerEligibility({
          ownerType: "STORE",
          ownerId: "store-1",
          userId: "user-1",
          active: false,
          suspended: false,
        }),
      ).toThrow(WithdrawalError);

      expect(() =>
        assertWithdrawalOwnerEligibility({
          ownerType: "DRIVER",
          ownerId: "driver-1",
          userId: "user-2",
          active: true,
          suspended: true,
        }),
      ).toThrow(WithdrawalError);
    });
  });
});
