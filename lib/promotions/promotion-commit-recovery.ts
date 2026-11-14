import { prisma } from "@/lib/db/prisma";
import { onVerifiedMarketplacePaymentSucceededInProduction } from "@/lib/marketplace-checkout/marketplace-payment-success-hook.service";
import { assertPromotionsProductionReady } from "./production-lock";

/** Retry the existing payment finalizer; it owns verification, inventory and redemption atomicity. */
export async function recoverPromotionCommitments({ limit = 100, after, apply = false }: { limit?: number; after?: string; apply?: boolean } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || (after !== undefined && (!after || after.length > 200))) throw new Error("Invalid promotion recovery scan parameters.");
  if (apply) assertPromotionsProductionReady("COMMITMENT");
  const rows = await prisma.promotionReservation.findMany({ where: { status: "RESERVED", ...(after ? { id: { gt: after } } : {}) }, select: { id: true, checkoutId: true }, orderBy: { id: "asc" }, take: limit + 1 });
  const page = rows.slice(0, limit);
  let eligible = 0, completed = 0, failed = 0;
  const seen = new Set<string>();
  for (const row of page) {
    if (seen.has(row.checkoutId)) continue;
    seen.add(row.checkoutId);
    const checkout = await prisma.marketplaceCheckout.findUnique({ where: { id: row.checkoutId }, select: { status: true, payment: { select: { id: true, status: true, subjectType: true } }, marketplaceOrder: { select: { id: true } } } });
    if (!checkout || checkout.status !== "RECONCILIATION_REQUIRED" || checkout.marketplaceOrder || checkout.payment?.status !== "SUCCEEDED" || checkout.payment.subjectType !== "MARKETPLACE_CHECKOUT") continue;
    eligible++;
    if (!apply) continue;
    try {
      await onVerifiedMarketplacePaymentSucceededInProduction(checkout.payment.id);
      const [order, reservation] = await Promise.all([
        prisma.marketplaceOrder.findUnique({ where: { checkoutId: row.checkoutId }, select: { id: true, paymentId: true } }),
        prisma.promotionReservation.findUnique({ where: { id: row.id }, select: { status: true, redemption: { select: { marketplaceOrderId: true } } } }),
      ]);
      if (!order || order.paymentId !== checkout.payment.id || reservation?.status !== "COMMITTED" || reservation.redemption?.marketplaceOrderId !== order.id) throw new Error("Promotion commitment was not confirmed.");
      completed++;
    }
    catch { failed++; }
  }
  return { examined: page.length, eligible, completed, failed, nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}
