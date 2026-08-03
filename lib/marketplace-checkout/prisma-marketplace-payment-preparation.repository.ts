/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is deferred by the Phase 20 validation boundary. */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { MarketplacePaymentPreparationRepository } from "@/lib/marketplace-checkout/marketplace-payment-preparation.service";

const money = (value: any) => typeof value === "string" ? value : value?.toFixed?.(2) ?? "0.00";

/** Concrete Phase 10/11 checkout-payment repository; no fabricated courier order is used. */
export function createPrismaMarketplacePaymentPreparationRepository(database: any = prisma): MarketplacePaymentPreparationRepository {
  let db = database;
  return Object.freeze({
    transaction: async <T>(work: () => Promise<T>) => database.$transaction(async (tx: any) => { const previous = db; db = tx; try { return await work(); } finally { db = previous; } }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    lockCheckout: async (reference) => {
      await db.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "publicReference" = ${reference} FOR UPDATE`);
      const checkout = await db.marketplaceCheckout.findUnique({ where: { publicReference: reference }, include: { payment: true, reservations: { where: { status: { in: ["ACTIVE", "PAYMENT_PENDING_HOLD"] } }, take: 1 } } });
      if (!checkout) return null;
      return Object.freeze({ id: checkout.id, publicReference: checkout.publicReference, customerUserId: checkout.customerUserId, guestAccessTokenHash: checkout.guestAccessTokenHash, status: checkout.status, grandTotal: money(checkout.grandTotal), currency: checkout.currency, acceptedFingerprint: checkout.acceptedFingerprint, payment: checkout.payment ? { id: checkout.payment.id, publicReference: checkout.payment.publicReference, amount: money(checkout.payment.amount), currency: checkout.payment.currency, fingerprint: (checkout.payment.metadata as { commercialFingerprint?: string } | null)?.commercialFingerprint ?? null } : null, reservationActive: checkout.reservations.length === 1 });
    },
    linkPayment: async (checkoutId, paymentId) => { await db.payment.update({ where: { id: paymentId }, data: { marketplaceCheckoutId: checkoutId } }); },
    transitionCheckout: async (checkoutId, status) => { await db.marketplaceCheckout.update({ where: { id: checkoutId }, data: { status } }); },
  });
}
