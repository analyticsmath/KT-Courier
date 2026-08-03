import { describe, expect, it } from "vitest";
import { reviewSubscriptionPurchase } from "@/lib/subscriptions/subscription-review.service";

describe("subscription-review.service / subscription-acknowledgement-policy", () => {
  it("freezes a customer review without trusting a client price", async () => {
    let saved: unknown;
    const review = await reviewSubscriptionPurchase({ resolveActivePlan: async () => ({ id: "plan-id", publicReference: "plan", programId: "program", subjectType: "CUSTOMER", status: "ACTIVE", displayName: "Member", shortDescription: "Monthly", fullDescription: "Monthly plan", contractTermType: "ROLLING_MONTH_TO_MONTH", billingInterval: "MONTH", billingIntervalCount: 1, priceAmount: "19.99", currency: "ZAR", taxTreatment: "INCLUDED", includedTaxAmount: "0.00", cancellationPolicyVersion: "cancel-v1", renewalPolicyVersion: "renew-v1", dunningPolicyVersion: "dunning-v1", entitlementPolicyVersion: "benefits-v1", legalDocumentVersion: "terms-v1", effectiveFrom: null, effectiveUntil: null, benefits: [] }), hasNonTerminalContract: async () => false, storePayerAuthorised: async () => false, createReview: async (input) => { saved = input; } }, { planReference: "plan", subjectType: "CUSTOMER", customerUserId: "customer", storeId: null, payerUserId: "customer", supplierIdentity: { reference: "supplier" }, termsVersion: "terms-v1", privacyVersion: "privacy-v1", at: new Date("2026-07-19T00:00:00Z") });
    expect(review.disclosure.plan.priceAmount).toBe("19.99");
    expect(saved).toMatchObject({ payerUserId: "customer", commercialFingerprint: review.commercialFingerprint });
  });
});
