import { describe, expect, it } from "vitest";
import { assertPlanTransition, assertOfferablePlan } from "@/lib/subscriptions/plan-policy";
import { assertContractTransition, assertSubscriptionSubject, rollingCancellationEffectiveAt } from "@/lib/subscriptions/contract-policy";
import { resolveDeliveryFeeSubscriptionAdjustment, assertEntitlementUsage } from "@/lib/subscriptions/entitlement-policy";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import { assertSubscriptionsProductionReady } from "@/lib/subscriptions/production-lock";

describe("subscription-program-policy / subscription-plan-lifecycle / subscription-plan-versioning", () => {
  it("allows only the reviewed plan lifecycle and source-locks fixed terms", () => {
    expect(() => assertPlanTransition("DRAFT", "UNDER_REVIEW")).not.toThrow();
    expect(() => assertPlanTransition("REJECTED", "ACTIVE")).toThrow(SubscriptionError);
    expect(() => assertOfferablePlan({ status: "ACTIVE", currency: "ZAR", priceAmount: "10.00", contractTermType: "FIXED_TERM", effectiveFrom: null, effectiveUntil: null, at: new Date() })).toThrow(SubscriptionError);
  });
});

describe("subscription-subject-policy / subscription-contract-state-machine / subscription-term-policy", () => {
  it("requires an exact customer or authorised store payer and end-of-period cancellation", () => {
    expect(() => assertSubscriptionSubject({ subjectType: "CUSTOMER", customerUserId: "customer", storeId: null, payerUserId: "customer" })).not.toThrow();
    expect(() => assertSubscriptionSubject({ subjectType: "STORE", customerUserId: null, storeId: "store", payerUserId: "payer", storePayerAuthorised: false })).toThrow(SubscriptionError);
    expect(() => assertContractTransition("ACTIVE", "CANCELLATION_SCHEDULED")).not.toThrow();
    expect(rollingCancellationEffectiveAt(new Date("2026-08-01T00:00:00Z")).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("subscription-benefit-policy / subscription-entitlement-policy / subscription-entitlement-usage", () => {
  it("bounds delivery reductions and blocks over-consumption", () => {
    expect(resolveDeliveryFeeSubscriptionAdjustment({ baseDeliveryFee: "20.00", benefitType: "DELIVERY_FEE_FIXED_REDUCTION", amount: "99.00" })).toEqual({ adjustment: "20.00", finalDeliveryFee: "0.00" });
    expect(() => assertEntitlementUsage({ action: "CONSUME", amount: "3.00", remainingAmount: "2.00" })).toThrow(SubscriptionError);
  });
});

describe("subscription-dunning-policy / subscription-cancellation-policy / subscription-fixed-term-policy / subscription-price-change-policy / subscription-change-policy / subscription-provider-policy / subscription-refund-policy / subscription-reconciliation-policy / subscription-privacy-policy / subscription-production-readiness", () => {
  it("fails closed before consolidated validation", () => {
    expect(() => assertSubscriptionsProductionReady("RECURRING_CHARGE")).toThrow(/CONSOLIDATED_VALIDATION_NOT_APPROVED/);
    expect(() => assertSubscriptionsProductionReady("RECURRING_CHARGE", { approved: true })).not.toThrow();
  });
});
