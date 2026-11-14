import { prisma } from "@/lib/db/prisma";
import type { CartOwner } from "@/lib/marketplace-checkout/cart.service";
import { assertPromotionsProductionReady } from "./production-lock";
import { computeCodeHmac, normalizePromotionCode } from "./promotion-code-policy";
import { resolvePromotionProductionComposition } from "./promotion-composition-root";
import { projectCheckoutPromotionFacts } from "./checkout-promotion-facts";

export function promotionCodeHash(code: string, suppliedKey?: string) {
  const key = process.env.PROMOTION_CODE_HMAC_KEY;
  if (!key || key.length < 32 || (suppliedKey !== undefined && suppliedKey !== key)) throw new Error("Coupon setup is unavailable.");
  if (typeof code !== "string" || code.length > 80) throw new Error("Invalid promotion code.");
  const normalized = normalizePromotionCode(code);
  if (!/^[A-Z0-9]{6,32}$/.test(normalized)) throw new Error("Invalid promotion code.");
  return computeCodeHmac(normalized, key);
}

/** Looks up code state; checkout eligibility is decided separately from source-owned facts. */
export async function validatePromotionCode(code: string, hmacKey: string) {
  assertPromotionsProductionReady("CODE_VALIDATE");
  const hash = promotionCodeHash(code, hmacKey);
  const now = new Date();
  const item = await prisma.promotionCode.findUnique({ where: { codeHmac: hash }, include: { campaignVersion: { include: { campaign: true, budget: true } } } });
  if (!item || item.status !== "ACTIVE" || item.campaignVersion.status !== "ACTIVE" || item.campaignVersion.applicationMethod !== "COUPON_CODE" || item.campaignVersion.campaign.status !== "ACTIVE" || item.campaignVersion.currency !== "ZAR" || item.campaignVersion.startsAt > now || item.campaignVersion.endsAt <= now || (item.startsAt && item.startsAt > now) || (item.expiresAt && item.expiresAt <= now) || !item.campaignVersion.budget || item.campaignVersion.budget.status !== "ACTIVE" || item.campaignVersion.budget.currency !== "ZAR") return null;
  const budget = item.campaignVersion.budget;
  if (budget.approvedAmount.minus(budget.reservedAmount).minus(budget.committedAmount).plus(budget.releasedAmount).plus(budget.reversedAmount).lessThan("0.01")) return null;
  if (item.maximumRedemptions !== null && await prisma.promotionRedemption.count({ where: { promotionCodeId: item.id, status: "COMMITTED" } }) >= item.maximumRedemptions) return null;
  return { reference: item.publicReference, maskedDisplay: item.maskedDisplay, campaignReference: item.campaignVersion.campaign.publicReference };
}

/** Preview a code only against a checkout owned by the authenticated customer or guest. */
export async function resolvePromotionCodeForCheckout(code: string, checkoutContext: { owner: CartOwner; checkoutReference: string }) {
  assertPromotionsProductionReady("CODE_VALIDATE");
  const { owner, checkoutReference } = checkoutContext ?? {};
  if (!owner || typeof checkoutReference !== "string" || !checkoutReference.trim() || checkoutReference.length > 200 || (owner.type === "CUSTOMER" ? !owner.userId : owner.type === "GUEST" ? !owner.guestTokenHash : true)) throw new Error("Checkout not found.");
  const appliedCouponCode = promotionCodeHash(code);
  const checkout = await prisma.marketplaceCheckout.findFirst({ where: { publicReference: checkoutReference, ...(owner.type === "CUSTOMER" ? { customerUserId: owner.userId } : { customerUserId: null, guestAccessTokenHash: owner.guestTokenHash }) }, include: { storeGroups: { include: { lines: { include: { modifiers: true } } } } } });
  if (!checkout) throw new Error("Checkout not found.");
  const result = await resolvePromotionProductionComposition("EVALUATION").evaluate({ ...projectCheckoutPromotionFacts(checkout, new Date()), appliedCouponCode });
  const applied = result.applied.find(item => item.applicationMethod === "COUPON_CODE");
  return applied ? { versionReference: applied.publicReference, discountAmount: applied.calculatedDiscount.toFixed(2), title: applied.customerFacingTitle } : null;
}
