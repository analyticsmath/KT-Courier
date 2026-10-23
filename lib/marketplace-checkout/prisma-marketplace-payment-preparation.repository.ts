import { restoreMarketplacePaymentRedirect } from "@/lib/marketplace-checkout/marketplace-payment-resume";
/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is deferred by the Phase 20 validation boundary. */
import { assertMarketplacePaymentPlanTotals } from "./payment-plan";
import { prisma } from "@/lib/db/prisma";
import type { MarketplacePaymentPreparationRepository } from "@/lib/marketplace-checkout/marketplace-payment-preparation.service";

const money = (value: any) => typeof value === "string" ? value : value?.toFixed?.(2) ?? "0.00";

/** Concrete Phase 10/11 checkout-payment repository; no fabricated courier order is used. */
export function createPrismaMarketplacePaymentPreparationRepository(database: any = prisma): MarketplacePaymentPreparationRepository {
  const db = database;
  return Object.freeze({
    transaction: async <T>(work: () => Promise<T>) => work(),
    lockCheckout: async (reference) => {
      const checkout = await db.marketplaceCheckout.findUnique({ where: { publicReference: reference }, include: { storeGroups: true, payment: { include: { attempts: { orderBy: { attemptNumber: "desc" }, take: 1, select: { status: true, checkoutActionType: true, redirectUrl: true, expiresAt: true } } } }, reservations: { where: { status: { in: ["ACTIVE", "PAYMENT_PENDING_HOLD"] } }, take: 1 } } });
      if (!checkout) return null;
      assertMarketplacePaymentPlanTotals({ grandTotal: money(checkout.grandTotal), digitalRequired: checkout.digitalRequired == null ? null : money(checkout.digitalRequired), cashRequired: money(checkout.cashRequired), groups: checkout.storeGroups.map((g: any) => ({ ...g, groupTotal: money(g.groupTotal) })) });
      return Object.freeze({ id: checkout.id, publicReference: checkout.publicReference, customerUserId: checkout.customerUserId, guestAccessTokenHash: checkout.guestAccessTokenHash, status: checkout.status, grandTotal: money(checkout.grandTotal), digitalRequired: money(checkout.digitalRequired ?? checkout.grandTotal), cashRequired: money(checkout.cashRequired), currency: checkout.currency, acceptedFingerprint: checkout.acceptedFingerprint, payment: checkout.payment ? { id: checkout.payment.id, publicReference: checkout.payment.publicReference, amount: money(checkout.payment.amount), currency: checkout.payment.currency, fingerprint: (checkout.payment.metadata as { commercialFingerprint?: string } | null)?.commercialFingerprint ?? null, providerAction: restoreMarketplacePaymentRedirect(checkout.payment.attempts?.[0]) } : null, reservationActive: checkout.reservations.length === 1 });
    },
    linkPayment: async (checkoutId, paymentId) => { await db.payment.update({ where: { id: paymentId }, data: { marketplaceCheckoutId: checkoutId } }); },
    transitionCheckout: async (checkoutId, status) => { await db.marketplaceCheckout.update({ where: { id: checkoutId }, data: { status } }); },
  });
}
