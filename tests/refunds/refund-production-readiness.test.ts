import { describe, expect, it } from "vitest";
import {
  assertRefundProductionActivation,
  evaluateRefundProductionReadiness,
  REFUND_PRODUCTION_READINESS,
  REFUND_PRODUCTION_VALIDATION_APPROVED,
} from "@/lib/refunds/refund-production-readiness";

describe("refund production readiness (risk-scoped C03)", () => {
  it("allows verified wallet refund handling even when KT_COMMERCE_ENABLED is false, while gating external provider execution on valid Paystack credentials", () => {
    expect(REFUND_PRODUCTION_VALIDATION_APPROVED).toBe(true);
    expect(REFUND_PRODUCTION_READINESS).toEqual(
      expect.objectContaining({ known: true, walletRefundsActive: true, productionValidationApproved: true }),
    );

    const prodNoPaystack = { NODE_ENV: "production", KT_COMMERCE_ENABLED: "false" };
    expect(evaluateRefundProductionReadiness(prodNoPaystack, "REQUEST")).toMatchObject({
      walletRefundsActive: true,
      externalRefundsActive: false,
      productionValidationApproved: true,
    });
    expect(() => assertRefundProductionActivation("REQUEST", prodNoPaystack)).not.toThrow();
    expect(() => assertRefundProductionActivation("EXTERNAL_PROVIDER", prodNoPaystack)).toThrow(/unavailable/i);

    const prodWithLivePaystackButCommerceOff = {
      NODE_ENV: "production",
      KT_COMMERCE_ENABLED: "false",
      PAYSTACK_MODE: "live",
      PAYSTACK_SECRET_KEY: "sk_live_test_only_fixture",
      PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com",
    };
    const ext = evaluateRefundProductionReadiness(prodWithLivePaystackButCommerceOff, "EXTERNAL_PROVIDER");
    expect(ext).toMatchObject({
      known: true,
      walletRefundsActive: true,
      externalRefundsActive: true,
      productionValidationApproved: true,
      blockReason: null,
    });
    expect(() => assertRefundProductionActivation("EXTERNAL_PROVIDER", prodWithLivePaystackButCommerceOff)).not.toThrow();

    const conflictingRuntime = {
      NODE_ENV: "test",
      KT_DATABASE_CLASSIFICATION: "production",
    };
    expect(() => assertRefundProductionActivation("REQUEST", conflictingRuntime)).toThrow(/unavailable/i);
  });
});
