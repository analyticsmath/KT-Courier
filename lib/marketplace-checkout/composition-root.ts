import { Phase6MarketplaceDeliveryQuoteAdapter } from "@/lib/marketplace-checkout/marketplace-delivery-quote.service";
import { createPhase6MarketplaceQuoteAuthority } from "@/lib/marketplace-checkout/phase6-marketplace-quote-authority";
import { assertMarketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";
import { createPrismaMarketplaceAcknowledgementRepository, createPrismaMarketplaceReviewRepository } from "@/lib/marketplace-checkout/prisma-review-composition.repository";
import { acknowledgeMarketplaceCheckoutReviewPersisted, reviewMarketplaceCheckout } from "@/lib/marketplace-checkout/checkout-review-persistence.service";
import { resolveMarketplaceCartLine, type CartOwner } from "@/lib/marketplace-checkout/cart.service";
import type { PromotionEvaluationAdapter, ReviewLine } from "@/lib/marketplace-checkout/checkout-review.service";
import { createPrismaCustomerDeliveryEntitlementRepository, SubscriptionAwareMarketplaceDeliveryQuoteAdapter } from "@/lib/subscriptions/subscription-delivery-benefit.service";
import { evaluateMarketplacePromotions } from "@/lib/promotions/promotion-evaluation.service";

class Phase23PromotionEvaluationAdapter implements PromotionEvaluationAdapter {
  async evaluate(input: Parameters<PromotionEvaluationAdapter["evaluate"]>[0]) {
    try {
      const result = await evaluateMarketplacePromotions(input as any, {} as any);
      return {
        totalDiscount: result.totalDiscount,
        totalPlatformFunding: result.totalPlatformFunding,
        totalStoreFunding: result.totalStoreFunding,
        allocations: result.allocations,
        evidence: {
          applied: result.applied,
          stackingEvidence: result.stackingEvidence,
        },
      };
    } catch (error: any) {
      if (error?.name === "PromotionsProductionLockedError") return null;
      throw error;
    }
  }
}

/**
 * The production root deliberately resolves every real authority before the
 * Phase 20 lock is checked. This makes the lock a readiness gate, never a
 * substitute for an unimplemented adapter.
 */
export function resolveMarketplaceCheckoutProductionComposition() {
  return Object.freeze({
    deliveryQuotes: new Phase6MarketplaceDeliveryQuoteAdapter(createPhase6MarketplaceQuoteAuthority()),
    phase6Authority: "pricing-quote.service.createPricingQuoteForTrustedOwner" as const,
    phase10Authority: "payment-preparation.service.prepareMarketplacePayment" as const,
    phase11Authority: "marketplace-payfast-checkout.service.prepareMarketplacePayfastCustomerAction" as const,
    phase12Authority: "marketplace-payment-success-hook.service.onVerifiedMarketplacePaymentSucceeded" as const,
    finalizationAuthority: "prisma-marketplace-finalization.repository.createPrismaMarketplaceFinalizationRepository" as const,
    settlementAuthority: "settlement.service.settleMarketplaceStoreOrder" as const,
  });
}

export function resolveAndAssertMarketplaceCheckoutOperation(
  operation: Parameters<typeof assertMarketplaceCheckoutProductionReady>[0],
) {
  const composition = resolveMarketplaceCheckoutProductionComposition();
  assertMarketplaceCheckoutProductionReady(operation);
  return composition;
}

function revalidatedLine(line: ReviewLine) {
  return resolveMarketplaceCartLine({
    offerReference: line.offerReference,
    variantReference: line.variantReference,
    quantity: line.quantity,
    modifiers: (line.modifiers ?? []).map((modifier) => ({ groupReference: modifier.groupReference, optionReference: modifier.optionReference, quantity: modifier.quantity })),
  }).then((resolved) => {
    const modifierUnitTotal = resolved.modifiers.reduce((total, modifier) => total + Number(modifier.priceDelta) * modifier.quantity, 0);
    const base = Number(resolved.unitPrice);
    return Object.freeze({
      available: true,
      quantity: resolved.quantity,
      priceVersion: resolved.priceVersion,
      publicationVersion: resolved.publicationVersion,
      baseUnitPrice: resolved.unitPrice,
      modifierUnitTotal: modifierUnitTotal.toFixed(2),
      lineTotal: ((base + modifierUnitTotal) * resolved.quantity).toFixed(2),
      modifierValid: true,
    });
  });
}

export async function executeMarketplaceCheckoutReview(input: Readonly<{
  reference: string; owner: CartOwner; operationId: string; requestHash: string; expectedVersion: number;
}>) {
  const composition = resolveAndAssertMarketplaceCheckoutOperation("CHECKOUT_REVIEW");
  const quoteAdapter = input.owner.type === "CUSTOMER"
    ? new SubscriptionAwareMarketplaceDeliveryQuoteAdapter(composition.deliveryQuotes, createPrismaCustomerDeliveryEntitlementRepository(), input.owner.userId, input.operationId)
    : composition.deliveryQuotes;
  return reviewMarketplaceCheckout(createPrismaMarketplaceReviewRepository(), {
    ...input,
    commissionPolicyVersion: "phase14-frozen-policy-v1",
    quoteAdapter,
    promotionAdapter: new Phase23PromotionEvaluationAdapter(),
    resolveLine: (line: any) => revalidatedLine(line) as any,
  });
}

export async function executeMarketplaceCheckoutAcknowledgement(input: Readonly<{
  reference: string; owner: CartOwner; operationId: string; requestHash: string; expectedVersion: number;
  reviewVersion: number; commercialFingerprint: string; acknowledgedTotalReference: string; termsVersion: string; privacyVersion: string; refundPolicyReferences: readonly string[];
}>) {
  resolveAndAssertMarketplaceCheckoutOperation("ACKNOWLEDGEMENT");
  return acknowledgeMarketplaceCheckoutReviewPersisted(createPrismaMarketplaceAcknowledgementRepository(), input);
}

export async function executeMarketplaceDeliveryQuotes(input: Readonly<{
  reference: string; owner: CartOwner; expectedVersion: number;
}>) {
  const composition = resolveAndAssertMarketplaceCheckoutOperation("DELIVERY_QUOTE");
  const repository = createPrismaMarketplaceReviewRepository();
  return repository.transaction(async () => {
    const checkout = await repository.lockCheckout(input.reference, input.owner);
    if (!checkout || checkout.version !== input.expectedVersion || !checkout.addressServiceAreaReference) throw new Error("Checkout delivery evidence is stale.");
    return Promise.all(checkout.groups.map(async (group) => composition.deliveryQuotes.quoteStoreGroup({
      checkoutReference: checkout.publicReference,
      storeReference: group.storeReference,
      pickupLocationReference: group.pickupLocationReference,
      serviceAreaReference: checkout.addressServiceAreaReference,
      fulfilmentMode: group.fulfilmentMode,
      lineCount: group.lines.length,
    })));
  });
}
