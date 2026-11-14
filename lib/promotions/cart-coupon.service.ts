import { prisma } from "@/lib/db/prisma";
import type { CartOwner } from "@/lib/marketplace-checkout/cart.service";
import { assertPromotionsProductionReady } from "./production-lock";
import { promotionCodeHash } from "./promotion-code.service";
import { projectCheckoutPromotionFacts } from "./checkout-promotion-facts";
import { resolvePromotionProductionComposition } from "./promotion-composition-root";

function ownerWhere(owner: CartOwner) {
  if (owner?.type === "CUSTOMER" && owner.userId) return { ownerType: "CUSTOMER" as const, customerUserId: owner.userId };
  if (owner?.type === "GUEST" && owner.guestTokenHash) return { ownerType: "GUEST" as const, customerUserId: null, guestTokenHash: owner.guestTokenHash };
  throw new Error("Cart is unavailable.");
}

export async function applyCouponToCart(owner: CartOwner, code: string) {
  assertPromotionsProductionReady("EVALUATION");
  const hash = promotionCodeHash(code);
  const scope = ownerWhere(owner);
  return prisma.$transaction(async tx => {
    const carts = await tx.marketplaceCart.findMany({ where: { ...scope, status: "ACTIVE" }, take: 2, select: { id: true } });
    if (carts.length !== 1) throw new Error("Cart is unavailable.");
    await tx.$queryRaw`SELECT id FROM "MarketplaceCart" WHERE id=${carts[0].id} FOR UPDATE`;
    const cart = await tx.marketplaceCart.findFirst({ where: { id: carts[0].id, ...scope, status: "ACTIVE" } });
    const item = await tx.promotionCode.findUnique({ where: { codeHmac: hash }, include: { campaignVersion: { include: { campaign: true, budget: true } } } });
    if (!cart || !item) throw new Error("Coupon is unavailable.");
    await tx.$queryRaw`SELECT id FROM "PromotionCode" WHERE id=${item.id} FOR UPDATE`;
    const current = await tx.promotionCode.findUniqueOrThrow({ where: { id: item.id }, include: { campaignVersion: { include: { campaign: true, budget: true } } } });
    const version = current.campaignVersion, budget = version.budget, now = new Date();
    if (current.status !== "ACTIVE" || version.status !== "ACTIVE" || version.campaign.status !== "ACTIVE" || version.applicationMethod !== "COUPON_CODE" || version.currency !== "ZAR" || version.startsAt > now || version.endsAt <= now || (current.startsAt && current.startsAt > now) || (current.expiresAt && current.expiresAt <= now) || !budget || budget.status !== "ACTIVE" || budget.currency !== "ZAR" || budget.approvedAmount.minus(budget.reservedAmount).minus(budget.committedAmount).plus(budget.releasedAmount).plus(budget.reversedAmount).lessThan("0.01") || (current.restrictedCustomerUserId && (owner.type !== "CUSTOMER" || current.restrictedCustomerUserId !== owner.userId))) throw new Error("Coupon is unavailable.");
    const [globalUses, customerUses] = await Promise.all([
      current.maximumRedemptions === null ? 0 : tx.promotionRedemption.count({ where: { promotionCodeId: current.id, status: "COMMITTED" } }),
      current.maximumRedemptionsPerCustomer === null || owner.type !== "CUSTOMER" ? 0 : tx.promotionRedemption.count({ where: { promotionCodeId: current.id, customerUserId: owner.userId, status: "COMMITTED" } }),
    ]);
    if ((current.maximumRedemptions !== null && globalUses >= current.maximumRedemptions) || (current.maximumRedemptionsPerCustomer !== null && (owner.type !== "CUSTOMER" || customerUses >= current.maximumRedemptionsPerCustomer))) throw new Error("Coupon is unavailable.");
    const result = cart.appliedPromotionCodeId === current.id ? cart : await tx.marketplaceCart.update({ where: { id: cart.id }, data: { appliedPromotionCodeId: current.id, version: { increment: 1 }, lastActivityAt: now } });
    return { cartReference: result.publicReference, version: result.version, coupon: current.maskedDisplay };
  }, { isolationLevel: "ReadCommitted" });
}

export async function removeCouponFromCart(owner: CartOwner) {
  assertPromotionsProductionReady("EVALUATION");
  const scope = ownerWhere(owner);
  return prisma.$transaction(async tx => {
    const carts = await tx.marketplaceCart.findMany({ where: { ...scope, status: "ACTIVE" }, take: 2, select: { id: true } });
    if (carts.length !== 1) throw new Error("Cart is unavailable.");
    await tx.$queryRaw`SELECT id FROM "MarketplaceCart" WHERE id=${carts[0].id} FOR UPDATE`;
    const cart = await tx.marketplaceCart.findFirst({ where: { id: carts[0].id, ...scope, status: "ACTIVE" } });
    if (!cart) throw new Error("Cart is unavailable.");
    const result = cart.appliedPromotionCodeId === null ? cart : await tx.marketplaceCart.update({ where: { id: cart.id }, data: { appliedPromotionCodeId: null, version: { increment: 1 }, lastActivityAt: new Date() } });
    return { cartReference: result.publicReference, version: result.version, coupon: null };
  }, { isolationLevel: "ReadCommitted" });
}

/** Evaluate from the latest owner-scoped, persisted checkout review, never invented cart prices. */
export async function evaluateEligiblePromotions(owner: CartOwner) {
  assertPromotionsProductionReady("EVALUATION");
  const scope = ownerWhere(owner);
  const carts = await prisma.marketplaceCart.findMany({ where: { ...scope, status: { in: ["ACTIVE", "CHECKOUT_LOCKED", "CONVERTED"] } }, orderBy: { updatedAt: "desc" }, take: 1, include: { appliedPromotionCode: { select: { codeHmac: true } } } });
  const cart = carts[0];
  if (!cart) throw new Error("Cart is unavailable.");
  const checkout = await prisma.marketplaceCheckout.findFirst({ where: { cartId: cart.id, ...(owner.type === "CUSTOMER" ? { customerUserId: owner.userId } : { customerUserId: null }), status: "READY_FOR_REVIEW" }, orderBy: { createdAt: "desc" }, include: { storeGroups: { include: { lines: { include: { modifiers: true } } } } } });
  if (!checkout) throw new Error("A current checkout review is required.");
  const result = await resolvePromotionProductionComposition("EVALUATION").evaluate({ ...projectCheckoutPromotionFacts(checkout, new Date()), ...(cart.appliedPromotionCode ? { appliedCouponCode: cart.appliedPromotionCode.codeHmac } : {}) });
  return { totalDiscount: result.totalDiscount.toFixed(2), applied: result.applied.map(item => ({ versionReference: item.publicReference, title: item.customerFacingTitle, discountAmount: item.calculatedDiscount.toFixed(2) })), rejected: result.rejected.map(item => ({ reason: item.reason })) };
}
