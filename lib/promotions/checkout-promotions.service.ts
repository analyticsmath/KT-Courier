/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { prisma } from "@/lib/db/prisma";
import { assertPromotionsProductionReady } from "./production-lock";
import { resolvePromotionProductionComposition } from "./promotion-composition-root";
import { projectCheckoutPromotionFacts } from "./checkout-promotion-facts";
import { reserveCheckoutPromotions } from "./promotion-reservation.service";

export async function viewFrozenPromotions(owner: any, checkoutReference: string) {
  assertPromotionsProductionReady("EVALUATION");
  
  const checkout = await prisma.marketplaceCheckout.findFirst({
    where: {
      publicReference: checkoutReference,
      ...(owner.type === "CUSTOMER" ? { customerUserId: owner.userId } : { guestAccessTokenHash: owner.guestTokenHash })
    }
  });
  if (!checkout) throw new Error("Checkout not found");

  const reservations = await prisma.promotionReservation.findMany({
    where: {
      checkoutId: checkout.id,
      checkoutReviewVersion: checkout.reviewVersion
    },
    include: {
      campaignVersion: true
    }
  });

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

  // Projection uses the current immutable checkout review, not the
  // original unit prices, stale previous reviews or fabricated JHB service.
  const now = new Date();
  const evaluationInput = projectCheckoutPromotionFacts(checkout, now);
  // Production still fails closed until independently approved. Once that
  // gate is opened, resolve the ACTUAL active, reviewed campaigns and
  // source-owned customer purchase/registration history; never [].
  const evaluator = resolvePromotionProductionComposition("EVALUATION");
  const evaluationResult = await evaluator.evaluate(evaluationInput);

  return prisma.$transaction(async (tx) => reserveCheckoutPromotions({
    checkoutId: checkout.id,
    checkoutReviewVersion: checkout.reviewVersion,
    customerUserId: checkout.customerUserId ?? undefined,
    guestEvidenceReference: checkout.guestAccessTokenHash ?? undefined,
    evaluationResult,
    appliedPromotions: evaluationResult.applied,
    operationId: input.operationId,
    requestHash: input.requestHash,
    now,
  }, tx));
}
