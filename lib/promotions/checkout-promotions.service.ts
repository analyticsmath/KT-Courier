/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { prisma } from "@/lib/db/prisma";
import { assertPromotionsProductionReady } from "./production-lock";
import { evaluateMarketplacePromotions } from "./promotion-evaluation.service";
import { reserveCheckoutPromotions } from "./promotion-reservation.service";
import { Decimal } from "@prisma/client/runtime/library";

export async function viewFrozenPromotions(owner: any, checkoutReference: string) {
  assertPromotionsProductionReady("EVALUATION");
  
  const checkout = await prisma.marketplaceCheckout.findFirst({
    where: {
      publicReference: checkoutReference,
      ...(owner.type === "CUSTOMER" ? { customerUserId: owner.userId } : { guestAccessTokenHash: owner.guestTokenHash })
    }
  });
  if (!checkout) throw new Error("Checkout not found");

  const reservations = await (prisma as any).promotionReservation.findMany({
    where: {
      checkoutId: checkout.id,
      checkoutReviewVersion: checkout.reviewVersion
    },
    include: {
      campaignVersion: true
    }
  }).catch(() => []);

  return {
    checkoutReference,
    reviewVersion: checkout.reviewVersion,
    reservations: reservations.map((r: any) => ({
      publicReference: r.publicReference,
      status: r.status,
      reservedDiscountAmount: r.reservedDiscountAmount.toFixed(2),
      reservedPlatformFunding: r.reservedPlatformFunding.toFixed(2),
      reservedStoreFunding: r.reservedStoreFunding.toFixed(2),
      expiresAt: r.expiresAt.toISOString(),
      campaignName: r.campaignVersion.campaignName,
      customerFacingTitle: r.campaignVersion.customerFacingTitle
    }))
  };
}

export async function reservePromotions(input: {
  owner: any;
  checkoutReference: string;
  operationId: string;
  requestHash: string;
}) {
  assertPromotionsProductionReady("RESERVATION");

  const checkout = await prisma.marketplaceCheckout.findFirst({
    where: {
      publicReference: input.checkoutReference,
      ...(input.owner.type === "CUSTOMER" ? { customerUserId: input.owner.userId } : { guestAccessTokenHash: input.owner.guestTokenHash })
    },
    include: {
      storeGroups: {
        include: {
          lines: {
            include: { modifiers: true }
          }
        }
      }
    }
  });
  if (!checkout) throw new Error("Checkout not found");

  // Load quotes for checkout (e.g. from store groups)
  const quotes = checkout.storeGroups.map((g) => ({
    storeReference: g.storeId,
    feeAmount: g.deliveryFee,
    deliveryServiceType: "STANDARD", // Default or map if available
    deliveryRegion: "JHB", // Default or map if available
  }));

  const storeGroups = checkout.storeGroups.map((g) => ({
    storeReference: g.storeId,
    lines: g.lines.map((l) => ({
      lineReference: l.id,
      merchandiseSubtotal: l.baseUnitPrice,
      modifierSubtotal: l.modifierUnitTotal,
      productId: l.productReference,
      variantId: l.variantReference,
      categoryId: "default",
    }))
  }));

  return prisma.$transaction(async (tx) => {
    // Run evaluation
    // Stub campaign version fetcher (returns empty list in stub/evaluation lock context)
    const evaluator = {
      fetchActiveCampaignVersions: async () => []
    };
    
    const evaluationResult = await evaluateMarketplacePromotions({
      checkoutId: checkout.id,
      customerUserId: checkout.customerUserId || undefined,
      guestEvidenceReference: checkout.guestAccessTokenHash || undefined,
      storeGroups,
      deliveryQuotes: quotes,
      now: new Date()
    }, evaluator);

    const reservationEvidence = await reserveCheckoutPromotions({
      checkoutId: checkout.id,
      checkoutReviewVersion: checkout.reviewVersion,
      customerUserId: checkout.customerUserId || undefined,
      guestEvidenceReference: checkout.guestAccessTokenHash || undefined,
      evaluationResult,
      appliedPromotions: evaluationResult.applied,
      operationId: input.operationId,
      requestHash: input.requestHash,
      now: new Date()
    }, tx);

    return reservationEvidence;
  });
}
