import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CartOwner } from "@/lib/marketplace-checkout/cart.service";
import { assertPromotionsProductionReady } from "./production-lock";
import { resolvePromotionProductionComposition } from "./promotion-composition-root";
import { projectCheckoutPromotionFacts } from "./checkout-promotion-facts";
import { reserveCheckoutPromotions } from "./promotion-reservation.service";
import { attachPromotionStoreReferences } from "./promotion-allocation-policy";

function checkoutOwner(owner: CartOwner) {
  if (owner?.type === "CUSTOMER" && owner.userId) return { customerUserId: owner.userId };
  if (owner?.type === "GUEST" && owner.guestTokenHash) return { customerUserId: null, guestAccessTokenHash: owner.guestTokenHash };
  throw new Error("Checkout not found");
}

export async function viewFrozenPromotions(owner: CartOwner, checkoutReference: string) {
  assertPromotionsProductionReady("EVALUATION");
  
  const checkout = await prisma.marketplaceCheckout.findFirst({
    where: {
      publicReference: checkoutReference,
      ...checkoutOwner(owner)
    }
  });
  if (!checkout) throw new Error("Checkout not found");

  const reservations = await prisma.promotionReservation.findMany({
    where: {
      checkoutId: checkout.id,
      checkoutReviewVersion: checkout.reviewVersion
    },
    include: {
      campaignVersion: { include: { campaign: { select: { name: true } } } }
    }
  });

  return {
    checkoutReference,
    reviewVersion: checkout.reviewVersion,
    reservations: reservations.map((r) => ({
      publicReference: r.publicReference,
      status: r.status,
      reservedDiscountAmount: r.reservedDiscountAmount.toFixed(2),
      reservedPlatformFunding: r.reservedPlatformFunding.toFixed(2),
      reservedStoreFunding: r.reservedStoreFunding.toFixed(2),
      expiresAt: r.expiresAt.toISOString(),
      campaignName: r.campaignVersion.campaign.name,
      customerFacingTitle: r.campaignVersion.customerFacingTitle
    }))
  };
}

export async function reservePromotions(input: {
  owner: CartOwner;
  checkoutReference: string;
  operationId: string;
}) {
  assertPromotionsProductionReady("RESERVATION");
  if (typeof input.operationId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(input.operationId)) throw new Error("A stable promotion operation ID is required.");

  const checkout = await prisma.marketplaceCheckout.findFirst({
    where: {
      publicReference: input.checkoutReference,
      ...checkoutOwner(input.owner)
    },
    include: {
      cart: { include: { appliedPromotionCode: { select: { codeHmac: true } } } },
      storeGroups: {
        include: {
          lines: {
            include: { modifiers: true }
          }
        }
      }
    }
  });
  if (!checkout || checkout.status !== "READY_FOR_REVIEW") throw new Error("Checkout not found or not ready for review.");

  const now = new Date();
  const couponHash = checkout.cart.appliedPromotionCode?.codeHmac;
  const review = await prisma.marketplaceCheckoutOperation.findFirst({ where: { checkoutId: checkout.id, type: "REVIEW" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { response: true } });
  const response = review?.response;
  if (!checkout.commercialFingerprint || !response || typeof response !== "object" || Array.isArray(response) || response.commercialFingerprint !== checkout.commercialFingerprint || !response.promotionEvidence || typeof response.promotionEvidence !== "object" || Array.isArray(response.promotionEvidence)) throw new Error("Promotion review evidence is unavailable.");
  const evidence = response.promotionEvidence.evidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence) || !Array.isArray(evidence.applied) || !evidence.applied.length) throw new Error("Promotion review evidence is unavailable.");
  const reviewed = evidence.applied.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.campaignVersionId !== "string" || typeof item.calculatedDiscount !== "string" || typeof item.platformFunding !== "string" || typeof item.storeFunding !== "string") throw new Error("Promotion review evidence is unavailable.");
    return item;
  });
  const versions = reviewed.map(item => item.campaignVersionId as string).sort();
  if (new Set(versions).size !== versions.length) throw new Error("Promotion review evidence is unavailable.");
  const requestHash = createHash("sha256").update(JSON.stringify({ checkoutId: checkout.id, reviewVersion: checkout.reviewVersion, customerUserId: checkout.customerUserId, guestEvidenceReference: checkout.guestAccessTokenHash, couponHash: couponHash ?? null, promotionDiscount: checkout.promotionDiscount.toFixed(2), versions, reviewed, allocations: response.promotionEvidence.allocations ?? null })).digest("hex");
  const receipt = await prisma.promotionOperation.findUnique({ where: { operationId: input.operationId } });
  if (receipt) {
    const reservations = await prisma.promotionReservation.findMany({ where: { operationId: input.operationId }, orderBy: { campaignVersionId: "asc" } });
    if (receipt.operationType !== "RESERVATION" || receipt.requestHash !== requestHash || reservations.length !== reviewed.length || reservations.some(row => {
      const item = reviewed.find(candidate => candidate.campaignVersionId === row.campaignVersionId);
      return !item || row.requestHash !== requestHash || row.checkoutId !== checkout.id || row.checkoutReviewVersion !== checkout.reviewVersion || row.customerUserId !== checkout.customerUserId || row.status !== "RESERVED" || row.expiresAt <= now || !row.reservedDiscountAmount.equals(String(item.calculatedDiscount)) || !row.reservedPlatformFunding.equals(String(item.platformFunding)) || !row.reservedStoreFunding.equals(String(item.storeFunding));
    })) throw new Error("Promotion reservation replay conflicts with the current checkout.");
    return { reservationIds: reservations.map(row => row.id), reservations, frozenEvaluation: { applied: reviewed, allocations: response.promotionEvidence.allocations ?? [] }, operationId: input.operationId, expiresAt: new Date(Math.min(...reservations.map(row => row.expiresAt.getTime()))) };
  }
  // Re-evaluate source-owned current review lines before creating a claim.
  const evaluationInput = projectCheckoutPromotionFacts(checkout, now);
  const evaluationResult = await resolvePromotionProductionComposition("EVALUATION").evaluate({ ...evaluationInput, ...(couponHash ? { appliedCouponCode: couponHash } : {}) });
  if (!evaluationResult.applied.length || evidence.applied.length !== evaluationResult.applied.length || !evaluationResult.totalDiscount.equals(checkout.promotionDiscount) || (couponHash && !evaluationResult.applied.some(item => item.applicationMethod === "COUPON_CODE"))) throw new Error("Promotion terms changed; review the checkout again.");
  for (const applied of evaluationResult.applied) {
    const matches = evidence.applied.filter(item => item && typeof item === "object" && !Array.isArray(item) && item.campaignVersionId === applied.campaignVersionId);
    const prior = matches[0];
    if (matches.length !== 1 || !prior || typeof prior !== "object" || Array.isArray(prior) || typeof prior.calculatedDiscount !== "string" || typeof prior.platformFunding !== "string" || typeof prior.storeFunding !== "string") throw new Error("Promotion terms changed; review the checkout again.");
    try {
      if (!new Prisma.Decimal(prior.calculatedDiscount).equals(applied.calculatedDiscount) || !new Prisma.Decimal(prior.platformFunding).equals(applied.platformFunding) || !new Prisma.Decimal(prior.storeFunding).equals(applied.storeFunding)) throw new Error();
    } catch { throw new Error("Promotion terms changed; review the checkout again."); }
  }
  const reviewedAllocations = response.promotionEvidence.allocations;
  if (!Array.isArray(reviewedAllocations) || !reviewedAllocations.length) throw new Error("Promotion allocation evidence is unavailable.");
  const groupTotals = (items: readonly { storeReference: string; discountAmount: Prisma.Decimal; platformFunding: Prisma.Decimal; storeFunding: Prisma.Decimal }[]) => {
    const totals = new Map<string, [Prisma.Decimal, Prisma.Decimal, Prisma.Decimal]>();
    for (const item of items) {
      const previous = totals.get(item.storeReference) ?? [new Prisma.Decimal(0), new Prisma.Decimal(0), new Prisma.Decimal(0)];
      totals.set(item.storeReference, [previous[0].plus(item.discountAmount), previous[1].plus(item.platformFunding), previous[2].plus(item.storeFunding)]);
    }
    return totals;
  };
  const priorAllocations = reviewedAllocations.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.storeReference !== "string" || typeof item.discountAmount !== "string" || typeof item.platformFunding !== "string" || typeof item.storeFunding !== "string") throw new Error("Promotion allocation evidence is unavailable.");
    return { storeReference: item.storeReference, discountAmount: new Prisma.Decimal(item.discountAmount), platformFunding: new Prisma.Decimal(item.platformFunding), storeFunding: new Prisma.Decimal(item.storeFunding) };
  });
  const reviewedTotals = groupTotals(priorAllocations);
  const currentTotals = groupTotals(attachPromotionStoreReferences(evaluationResult.allocations, evaluationInput.storeGroups));
  if (reviewedTotals.size !== currentTotals.size || [...reviewedTotals].some(([store, totals]) => { const current = currentTotals.get(store); return !current || totals.some((value, index) => !value.equals(current[index])); })) throw new Error("Promotion store allocations changed; review the checkout again.");
  return prisma.$transaction(async (tx) => reserveCheckoutPromotions({
    checkoutId: checkout.id,
    checkoutReviewVersion: checkout.reviewVersion,
    customerUserId: checkout.customerUserId ?? undefined,
    guestEvidenceReference: checkout.guestAccessTokenHash ?? undefined,
    evaluationResult,
    appliedPromotions: evaluationResult.applied,
    operationId: input.operationId,
    requestHash,
    ...(couponHash ? { appliedCouponCode: couponHash } : {}),
    now,
  }, tx));
}
