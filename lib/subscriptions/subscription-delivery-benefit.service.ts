import { resolveDeliveryFeeSubscriptionAdjustment } from "@/lib/subscriptions/entitlement-policy";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { createPrismaSubscriptionEntitlementUsageRepository } from "@/lib/subscriptions/subscription-entitlement-usage.service";
import type { MarketplaceDeliveryQuoteAdapter, MarketplaceDeliveryQuoteInput, MarketplaceDeliveryQuoteResult } from "@/lib/marketplace-checkout/marketplace-delivery-quote.service";

export type CustomerDeliveryEntitlementRepository = Readonly<{
  findEligibleDeliveryGrant(input: Readonly<{ customerUserId: string; at: Date }>): Promise<Readonly<{ grantReference: string; benefitReference: string; benefitType: "DELIVERY_FEE_PERCENT_REDUCTION" | "DELIVERY_FEE_FIXED_REDUCTION" | "DELIVERY_FEE_PERIOD_ALLOWANCE" | "INCLUDED_ELIGIBLE_DELIVERY_COUNT"; amount: string | null; remainingAmount: string | null; remainingQuantity: number | null; sourceVersion: string }> | null>;
  reserve(input: Readonly<{ grantReference: string; operationId: string; requestHash: string; amount: string; quantity: number | null; sourceReference: string }>): Promise<Readonly<{ usageReference: string; replayed: boolean }>>;
}>;

/**
 * This adapter receives an already-authoritative Phase 6 base fee. It accepts
 * no client-submitted discount and returns evidence that Phase 20 can freeze.
 */
export async function resolveCustomerDeliverySubscriptionBenefit(repository: CustomerDeliveryEntitlementRepository, input: Readonly<{ customerUserId: string; serviceType: string; authoritativeBaseDeliveryFee: string; deliveryDate: Date; checkoutReference: string; entitlementOperationId: string; requestHash: string }>) {
  if (!input.customerUserId || !input.serviceType || !input.checkoutReference || !input.entitlementOperationId) throw new SubscriptionError("SUBSCRIPTION_ENTITLEMENT_INVALID", "Subscription delivery benefit evidence is incomplete.");
  const grant = await repository.findEligibleDeliveryGrant({ customerUserId: input.customerUserId, at: input.deliveryDate });
  if (!grant) return Object.freeze({ eligible: false as const, adjustment: "0.00", finalDeliveryFee: input.authoritativeBaseDeliveryFee, reservation: null });
  const result = resolveDeliveryFeeSubscriptionAdjustment({ baseDeliveryFee: input.authoritativeBaseDeliveryFee, benefitType: grant.benefitType, amount: grant.amount, remainingAmount: grant.remainingAmount, remainingQuantity: grant.remainingQuantity });
  const quantity = grant.benefitType === "INCLUDED_ELIGIBLE_DELIVERY_COUNT" ? 1 : null;
  const reservation = await repository.reserve({ grantReference: grant.grantReference, operationId: input.entitlementOperationId, requestHash: input.requestHash, amount: result.adjustment, quantity, sourceReference: input.checkoutReference });
  return Object.freeze({ eligible: true as const, adjustment: result.adjustment, finalDeliveryFee: result.finalDeliveryFee, grantReference: grant.grantReference, benefitReference: grant.benefitReference, benefitVersion: grant.sourceVersion, reservation });
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 22 generated client is deferred. */
export function createPrismaCustomerDeliveryEntitlementRepository(database: any = prisma): CustomerDeliveryEntitlementRepository {
  const usage = createPrismaSubscriptionEntitlementUsageRepository(database);
  return Object.freeze({
    async findEligibleDeliveryGrant({ customerUserId, at }) {
      const grant = await database.subscriptionEntitlementGrant.findFirst({ where: { customerUserId, status: "ACTIVE", effectiveFrom: { lte: at }, effectiveUntil: { gt: at }, billingCycle: { status: "PAID" }, contract: { status: { in: ["ACTIVE", "CANCELLATION_SCHEDULED"] } }, benefitDefinition: { benefitType: { in: ["DELIVERY_FEE_PERCENT_REDUCTION", "DELIVERY_FEE_FIXED_REDUCTION", "DELIVERY_FEE_PERIOD_ALLOWANCE", "INCLUDED_ELIGIBLE_DELIVERY_COUNT"] }, permittedConsumingPhase: "CHECKOUT_REVIEW" } }, include: { benefitDefinition: true }, orderBy: { effectiveUntil: "asc" } });
      return grant ? { grantReference: grant.publicReference, benefitReference: grant.benefitDefinition.publicReference, benefitType: grant.benefitDefinition.benefitType, amount: grant.benefitDefinition.amount?.toFixed(2) ?? null, remainingAmount: grant.remainingAmount?.toFixed(2) ?? null, remainingQuantity: grant.remainingQuantity, sourceVersion: grant.benefitDefinition.sourceVersion } : null;
    },
    async reserve(input) {
      const result = await usage.apply({ grantReference: input.grantReference, action: "RESERVE", operationId: input.operationId, requestHash: input.requestHash, amount: input.amount, quantity: input.quantity, sourceType: "MARKETPLACE_CHECKOUT", sourceReference: input.sourceReference });
      return { usageReference: result.usageReference, replayed: result.replayed };
    },
  });
}

/** Phase 6 produces the base quote; this Phase 22 composition only reserves a paid entitlement and lowers that quote. */
export class SubscriptionAwareMarketplaceDeliveryQuoteAdapter implements MarketplaceDeliveryQuoteAdapter {
  constructor(private readonly phase6: MarketplaceDeliveryQuoteAdapter, private readonly repository: CustomerDeliveryEntitlementRepository, private readonly customerUserId: string, private readonly operationId: string) {}

  async quoteStoreGroup(input: MarketplaceDeliveryQuoteInput): Promise<MarketplaceDeliveryQuoteResult> {
    const quote = await this.phase6.quoteStoreGroup(input);
    const sourceReference = `${input.checkoutReference}:${input.storeReference}:${quote.publicReference}`;
    const requestHash = createHash("sha256").update(JSON.stringify({ sourceReference, baseFee: quote.fee, version: quote.version })).digest("hex");
    const benefit = await resolveCustomerDeliverySubscriptionBenefit(this.repository, { customerUserId: this.customerUserId, serviceType: input.fulfilmentMode, authoritativeBaseDeliveryFee: quote.fee, deliveryDate: new Date(), checkoutReference: input.checkoutReference, entitlementOperationId: `${this.operationId}:${quote.publicReference}`, requestHash, });
    return Object.freeze({ ...quote, fee: benefit.finalDeliveryFee, ...(benefit.reservation ? { version: `${quote.version}:subscription:${benefit.reservation.usageReference}` } : {}) });
  }
}
