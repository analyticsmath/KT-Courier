/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic transaction client parameter and json payload navigation */
import { assertMarketplacePaymentPlanTotals, digitalMarketplacePaymentPlan, marketplacePaymentPlansEqual, parseMarketplacePaymentPlan, resolveMarketplacePaymentPlan } from "./payment-plan";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveMarketplaceCartLine } from "./cart.service";
import { assertMarketplaceLegalEvidence, resolveMarketplaceLegalEvidence } from "./legal-evidence";
import { listDeliveryMatrices } from "./delivery-policy-configuration";
import { MarketplaceCheckoutError } from "./errors";

/** Recheck mutable authorities before the first provider action, while retaining
 * frozen settlement facts. A changed source must produce a new customer review.
 */
export async function assertAcceptedCheckoutEvidence(checkoutId: string, at = new Date(), db: any = prisma): Promise<void> {
  const checkout = await db.marketplaceCheckout.findUniqueOrThrow({ where: { id: checkoutId }, include: { acknowledgements: { orderBy: { reviewVersion: "desc" }, take: 1 }, storeGroups: { include: { store: { select: { ownerUserId: true } }, lines: { include: { modifiers: true } } } } } });
  const fail = (): never => { throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Checkout source evidence changed or expired. Review the current order before payment."); };
  const accepted = checkout.acknowledgements[0];
  if (!accepted || accepted.reviewVersion !== checkout.reviewVersion || accepted.commercialFingerprint !== checkout.acceptedFingerprint || !accepted.grandTotal.equals(checkout.grandTotal)) fail();
  assertMarketplaceLegalEvidence({ termsVersion: accepted.termsVersion, privacyVersion: accepted.privacyVersion, refundPolicyReferences: accepted.refundPolicyReferences as string[] }, await resolveMarketplaceLegalEvidence(db, at));
  if (!checkout.contactSnapshotId || !checkout.addressSnapshotId) fail();
  if (!checkout.customerUserId && !await db.marketplaceGuestContactVerification.findFirst({ where: { checkoutId, contactSnapshotId: checkout.contactSnapshotId!, verifiedAt: { not: null } } })) fail();
  const activeMatrices = (await listDeliveryMatrices()).filter((v: any) => v.status === "ACTIVE" && v.approvedAt && v.approvedByUserId && v.approvedByUserId !== v.createdByUserId && new Date(v.effectiveFrom) <= at && (!v.effectiveTo || new Date(v.effectiveTo) > at));
  const currentMatrixVersion = Math.max(0, ...activeMatrices.map((v: any) => v.version));
  assertMarketplacePaymentPlanTotals({ grandTotal: checkout.grandTotal.toFixed(2), digitalRequired: checkout.digitalRequired?.toFixed(2), cashRequired: checkout.cashRequired.toFixed(2), groups: checkout.storeGroups.map((g: any) => ({ ...g, groupTotal: g.groupTotal.toFixed(2) })) });

  const grossCheckoutTotal = checkout.storeGroups.reduce((sum: Prisma.Decimal, g: any) => sum.add(g.groupTotal), new Prisma.Decimal(0));
  const expectedGross = checkout.merchandiseSubtotal.add(checkout.modifierSubtotal).add(checkout.deliveryFeeTotal);
  if (!grossCheckoutTotal.equals(expectedGross)) fail();

  const totalPromoDiscount = new Prisma.Decimal(checkout.promotionDiscount ?? 0);
  if (totalPromoDiscount.lt(0) || totalPromoDiscount.gt(grossCheckoutTotal)) fail();

  const expectedGrandTotal = grossCheckoutTotal.minus(totalPromoDiscount);
  if (!checkout.grandTotal.equals(expectedGrandTotal)) fail();

  const digitalReq = new Prisma.Decimal(checkout.digitalRequired ?? checkout.grandTotal);
  const cashReq = new Prisma.Decimal(checkout.cashRequired ?? 0);
  if (!digitalReq.add(cashReq).equals(checkout.grandTotal)) fail();
  if (totalPromoDiscount.gt(0) && !cashReq.isZero()) fail();

  if (totalPromoDiscount.gt(0)) {
    const reviewOp = await db.marketplaceCheckoutOperation.findFirst({
      where: { checkoutId: checkout.id, type: "REVIEW" },
      orderBy: { createdAt: "desc" },
    });
    if (reviewOp?.response) {
      const resp = reviewOp.response as any;
      if (resp.commercialFingerprint && resp.commercialFingerprint !== accepted.commercialFingerprint) fail();
      if (resp.promotionDiscount && !new Prisma.Decimal(resp.promotionDiscount).equals(totalPromoDiscount)) fail();
      const applied = resp.promotionEvidence?.evidence?.applied;
      if (Array.isArray(applied) && applied.length) {
        const versionIds = applied.map((item: any) => item?.campaignVersionId);
        if (versionIds.some((id: unknown) => typeof id !== "string" || !id) || new Set(versionIds).size !== versionIds.length) fail();
        const reservations = await db.promotionReservation.findMany({ where: { checkoutId: checkout.id, checkoutReviewVersion: checkout.reviewVersion, campaignVersionId: { in: versionIds }, status: "RESERVED", expiresAt: { gt: at } } });
        if (reservations.length !== versionIds.length || !reservations.reduce((total: Prisma.Decimal, reservation: any) => total.add(reservation.reservedDiscountAmount), new Prisma.Decimal(0)).equals(totalPromoDiscount)) fail();
        for (const item of applied) {
          const matches = reservations.filter((reservation: any) => reservation.campaignVersionId === item.campaignVersionId);
          if (matches.length !== 1 || !matches[0].reservedDiscountAmount.equals(item.calculatedDiscount) || !matches[0].reservedPlatformFunding.equals(item.platformFunding) || !matches[0].reservedStoreFunding.equals(item.storeFunding)) fail();
        }
      }
    }
  }

  let sumGroupDiscounts = new Prisma.Decimal(0);
  let sumGroupNetLiabilities = new Prisma.Decimal(0);

  for (const group of checkout.storeGroups) {
    if (!group.deliveryQuoteReference || !group.deliveryQuoteExpiresAt || group.deliveryQuoteExpiresAt <= at || !group.deliveryQuoteVersion) fail();
    const quote = await db.pricingQuote.findUnique({ where: { id: group.deliveryQuoteReference! } });
    if (!quote) return fail();
    if (quote.expiresAt <= at || quote.ownerId !== group.store.ownerUserId || quote.storeId !== group.storeId || !quote.total.equals(group.deliveryFee)) fail();
    if (group.paymentPlan) {
      const plan = parseMarketplacePaymentPlan(group.paymentPlan);
      const groupNetLiability = new Prisma.Decimal(plan.authoritativeTotal);
      if (groupNetLiability.lt(0) || groupNetLiability.gt(group.groupTotal)) fail();

      const groupDiscount = group.groupTotal.minus(groupNetLiability);
      sumGroupDiscounts = sumGroupDiscounts.add(groupDiscount);
      sumGroupNetLiabilities = sumGroupNetLiabilities.add(groupNetLiability);

      let current;
      if (totalPromoDiscount.gt(0)) {
        if (plan.mode !== "DIGITAL_ONLY" || !new Prisma.Decimal(plan.cashRequired).isZero()) fail();
        current = digitalMarketplacePaymentPlan(groupNetLiability.toFixed(2));
      } else {
        const pickup = await db.store.findUnique({ where: { id: group.storeId }, include: { defaultPickupAddress: true } });
        const destination = await db.marketplaceCheckoutAddressSnapshot.findUnique({ where: { id: checkout.addressSnapshotId! } });
        current = await resolveMarketplacePaymentPlan({
          storeId: group.storeId,
          orderType: "STORE",
          deliveryServiceId: quote.deliveryType,
          deliveryServiceKey: quote.deliveryType,
          regionId: quote.destinationRegionId,
          originLocality: { city: pickup?.defaultPickupAddress?.city, suburb: pickup?.defaultPickupAddress?.line2, province: pickup?.defaultPickupAddress?.province },
          destinationLocality: { city: destination?.city, suburb: destination?.suburb, province: destination?.province },
          provinces: [...new Set([pickup?.defaultPickupAddress?.province, destination?.province].filter((p): p is string => Boolean(p)))],
          total: groupNetLiability.toFixed(2),
          fulfilmentMode: group.fulfilmentMode,
          groupCount: checkout.storeGroups.length,
          promotionDiscount: "0.00",
        }, db);
      }
      if (!marketplacePaymentPlansEqual(current, group.paymentPlan)) fail();
    }
    const rule = quote.ruleSnapshot as { policyVersion?: number; policyAuthority?: string };
    if (rule.policyAuthority === "marketplace_delivery_matrix" && rule.policyVersion !== currentMatrixVersion) fail();
    for (const line of group.lines.filter((l: any) => l.reviewVersion === checkout.reviewVersion)) {
      const source = await resolveMarketplaceCartLine({ offerReference: line.offerReference, variantReference: line.variantReference, quantity: line.quantity, modifiers: line.modifiers.map((m: any) => ({ groupReference: m.groupReference, optionReference: m.optionReference, quantity: m.quantity })) });
      const modifierTotal = source.modifiers.reduce((total: Prisma.Decimal, modifier: any) => total.add(new Prisma.Decimal(modifier.priceDelta).mul(modifier.quantity)), new Prisma.Decimal(0));
      if (source.storeId !== group.storeId || source.priceVersion !== line.priceVersion || source.publicationVersion !== line.publicationVersion || !line.baseUnitPrice.equals(source.unitPrice) || !line.modifierUnitTotal.equals(modifierTotal) || !line.lineTotal.equals(new Prisma.Decimal(source.unitPrice).add(modifierTotal).mul(line.quantity))) fail();
    }
  }

  if (checkout.storeGroups.some((g: any) => g.paymentPlan)) {
    if (!sumGroupDiscounts.equals(totalPromoDiscount)) fail();
    if (!sumGroupNetLiabilities.equals(checkout.grandTotal)) fail();
  }
}
