import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveMarketplaceCartLine } from "./cart.service";
import { assertMarketplaceLegalEvidence, resolveMarketplaceLegalEvidence } from "./legal-evidence";
import { listDeliveryMatrices } from "./delivery-policy-configuration";
import { MarketplaceCheckoutError } from "./errors";

/** Recheck mutable authorities before the first provider action, while retaining
 * frozen settlement facts. A changed source must produce a new customer review.
 */
export async function assertAcceptedCheckoutEvidence(checkoutId: string, at = new Date()): Promise<void> {
  const checkout = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: checkoutId }, include: { acknowledgements: { orderBy: { reviewVersion: "desc" }, take: 1 }, storeGroups: { include: { store: { select: { ownerUserId: true } }, lines: { include: { modifiers: true } } } } } });
  const fail = (): never => { throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Checkout source evidence changed or expired. Review the current order before payment."); };
  const accepted = checkout.acknowledgements[0];
  if (!accepted || accepted.reviewVersion !== checkout.reviewVersion || accepted.commercialFingerprint !== checkout.acceptedFingerprint || !accepted.grandTotal.equals(checkout.grandTotal)) fail();
  assertMarketplaceLegalEvidence({ termsVersion: accepted.termsVersion, privacyVersion: accepted.privacyVersion, refundPolicyReferences: accepted.refundPolicyReferences as string[] }, await resolveMarketplaceLegalEvidence(prisma, at));
  if (!checkout.contactSnapshotId || !checkout.addressSnapshotId) fail();
  if (!checkout.customerUserId && !await prisma.marketplaceGuestContactVerification.findFirst({ where: { checkoutId, contactSnapshotId: checkout.contactSnapshotId!, verifiedAt: { not: null } } })) fail();
  const activeMatrices = (await listDeliveryMatrices()).filter(v => v.status === "ACTIVE" && v.approvedAt && v.approvedByUserId && v.approvedByUserId !== v.createdByUserId && new Date(v.effectiveFrom) <= at && (!v.effectiveTo || new Date(v.effectiveTo) > at));
  const currentMatrixVersion = Math.max(0, ...activeMatrices.map(v => v.version));
  for (const group of checkout.storeGroups) {
    if (!group.deliveryQuoteReference || !group.deliveryQuoteExpiresAt || group.deliveryQuoteExpiresAt <= at || !group.deliveryQuoteVersion) fail();
    const quote = await prisma.pricingQuote.findUnique({ where: { id: group.deliveryQuoteReference! } });
    if (!quote) return fail();
    if (quote.expiresAt <= at || quote.ownerId !== group.store.ownerUserId || quote.storeId !== group.storeId || !quote.total.equals(group.deliveryFee)) fail();
    const rule = quote.ruleSnapshot as { policyVersion?: number; policyAuthority?: string };
    if (rule.policyAuthority === "marketplace_delivery_matrix" && rule.policyVersion !== currentMatrixVersion) fail();
    for (const line of group.lines.filter(line => line.reviewVersion === checkout.reviewVersion)) {
      const source = await resolveMarketplaceCartLine({ offerReference: line.offerReference, variantReference: line.variantReference, quantity: line.quantity, modifiers: line.modifiers.map(m => ({ groupReference: m.groupReference, optionReference: m.optionReference, quantity: m.quantity })) });
      const modifierTotal = source.modifiers.reduce((total, modifier) => total.add(new Prisma.Decimal(modifier.priceDelta).mul(modifier.quantity)), new Prisma.Decimal(0));
      if (source.storeId !== group.storeId || source.priceVersion !== line.priceVersion || source.publicationVersion !== line.publicationVersion || !line.baseUnitPrice.equals(source.unitPrice) || !line.modifierUnitTotal.equals(modifierTotal) || !line.lineTotal.equals(new Prisma.Decimal(source.unitPrice).add(modifierTotal).mul(line.quantity))) fail();
    }
  }
}
