import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertCustomerWalletBankWithdrawalForbidden,
  assertWithdrawalProductionActivation,
  CUSTOMER_WALLET_BANK_WITHDRAWAL_ALLOWED,
  withdrawalProductionReadiness,
  WITHDRAWAL_PRODUCTION_BLOCK_REASON,
  WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED,
} from "@/lib/withdrawals/withdrawal-production-readiness";

describe("withdrawal production readiness (risk-scoped C03)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("strictly forbids customer wallet bank withdrawals regardless of flags", () => {
    expect(CUSTOMER_WALLET_BANK_WITHDRAWAL_ALLOWED).toBe(false);
    expect(() => assertCustomerWalletBankWithdrawalForbidden("CUSTOMER")).toThrowError(/not permitted/i);
    expect(() => assertCustomerWalletBankWithdrawalForbidden("DRIVER")).not.toThrow();
    expect(() => assertCustomerWalletBankWithdrawalForbidden("STORE")).not.toThrow();
  });

  it("requires explicit WITHDRAWAL_PAYOUT_ENABLED=true and live credentials for production earned payouts", () => {
    expect(WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED).toBe(true);
    expect(WITHDRAWAL_PRODUCTION_BLOCK_REASON).toBe("WITHDRAWAL_PAYOUT_DISABLED");

    const disabledInProd = { NODE_ENV: "production", WITHDRAWAL_PAYOUT_ENABLED: "false" };
    expect(withdrawalProductionReadiness(disabledInProd, "REQUEST")).toMatchObject({
      productionActive: false,
      payoutEnabled: false,
      customerBankWithdrawalAllowed: false,
      blockReason: "WITHDRAWAL_PAYOUT_DISABLED",
    });
    expect(() => assertWithdrawalProductionActivation(disabledInProd, "REQUEST")).toThrowError(/WITHDRAWAL_PAYOUT_DISABLED/);

    const enabledWithoutLiveCreds = { NODE_ENV: "production", WITHDRAWAL_PAYOUT_ENABLED: "true" };
    expect(withdrawalProductionReadiness(enabledWithoutLiveCreds, "REQUEST")).toMatchObject({
      productionActive: true,
      payoutEnabled: true,
      automatedTransferReady: false,
    });
    expect(withdrawalProductionReadiness(enabledWithoutLiveCreds, "AUTOMATED_TRANSFER")).toMatchObject({
      productionActive: false,
      automatedTransferReady: false,
    });

    const enabledWithLiveCreds = {
      NODE_ENV: "production",
      WITHDRAWAL_PAYOUT_ENABLED: "true",
      PAYSTACK_MODE: "live",
      PAYSTACK_SECRET_KEY: "sk_live_test_only_fixture",
      PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com",
    };
    expect(withdrawalProductionReadiness(enabledWithLiveCreds, "AUTOMATED_TRANSFER")).toMatchObject({
      productionActive: true,
      payoutEnabled: true,
      customerBankWithdrawalAllowed: false,
      automatedTransferReady: true,
      blockReason: null,
    });
    expect(() => assertWithdrawalProductionActivation(enabledWithLiveCreds, "AUTOMATED_TRANSFER")).not.toThrow();
  });

  it("blocks payouts during temporary sandbox window in production", () => {
    const sandboxInProd = {
      NODE_ENV: "production",
      WITHDRAWAL_PAYOUT_ENABLED: "true",
      PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "true",
    };
    expect(withdrawalProductionReadiness(sandboxInProd, "REQUEST")).toMatchObject({
      productionActive: false,
      blockReason: "PAYOUTS_FORBIDDEN_IN_TEMPORARY_SANDBOX",
    });
  });

  it("allows test/development verification without live payout flags", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(withdrawalProductionReadiness()).toMatchObject({
      productionActive: true,
      customerBankWithdrawalAllowed: false,
    });
    expect(() => assertWithdrawalProductionActivation()).not.toThrow();
  });
});
