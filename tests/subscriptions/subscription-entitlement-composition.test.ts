import { describe, expect, it } from "vitest";
import { resolveCustomerDeliverySubscriptionBenefit } from "@/lib/subscriptions/subscription-delivery-benefit.service";
import { resolveStoreSubscriptionCommissionEligibility } from "@/lib/subscriptions/subscription-commission-benefit.service";
import { SubscriptionError } from "@/lib/subscriptions/errors";

describe("subscription delivery benefit composition", () => {
  it("reserves only against an authoritative Phase 6 base fee and cannot make delivery negative", async () => {
    const calls: unknown[] = [];
    const result = await resolveCustomerDeliverySubscriptionBenefit({ findEligibleDeliveryGrant: async () => ({ grantReference: "grant_A1", benefitReference: "benefit_A1", benefitType: "DELIVERY_FEE_FIXED_REDUCTION", amount: "99.00", remainingAmount: "99.00", remainingQuantity: null, sourceVersion: "v1" }), reserve: async (input) => { calls.push(input); return { usageReference: "usage_A1", replayed: false }; } }, { customerUserId: "customer_A1", serviceType: "DELIVERY", authoritativeBaseDeliveryFee: "20.00", deliveryDate: new Date(), checkoutReference: "checkout_A1", entitlementOperationId: "op_A1", requestHash: "hash_A1" });
    expect(result).toMatchObject({ eligible: true, adjustment: "20.00", finalDeliveryFee: "0.00", reservation: { usageReference: "usage_A1" } });
    expect(calls).toEqual([expect.objectContaining({ amount: "20.00", sourceReference: "checkout_A1" })]);
  });

  it("keeps Phase 14 as the commission authority and returns only frozen eligibility", async () => {
    const eligibility = await resolveStoreSubscriptionCommissionEligibility({ findEligibility: async () => ({ contractReference: "subcon_A1", billingCycleReference: "subcyc_A1", grantReference: "grant_A1", benefitReference: "benefit_A1", sourceVersion: "v1", approvedCommissionPlanReference: "plan_A1", approvedCommissionPlanVersion: 4 }) }, { storeId: "store_A1", at: new Date() });
    expect(eligibility).toEqual(expect.objectContaining({ approvedCommissionPlanReference: "plan_A1", approvedCommissionPlanVersion: 4 }));
    expect(JSON.stringify(eligibility)).not.toMatch(/rate|percentage|amount/i);
  });

  it("rejects client-shaped delivery benefit requests", async () => {
    await expect(resolveCustomerDeliverySubscriptionBenefit({ findEligibleDeliveryGrant: async () => null, reserve: async () => ({ usageReference: "x", replayed: false }) }, { customerUserId: "", serviceType: "DELIVERY", authoritativeBaseDeliveryFee: "20.00", deliveryDate: new Date(), checkoutReference: "checkout", entitlementOperationId: "op", requestHash: "hash" })).rejects.toBeInstanceOf(SubscriptionError);
  });
});
