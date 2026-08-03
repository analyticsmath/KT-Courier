import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

export const paymentPrisma = new PrismaClient();

export async function resetPaymentTables() {
  await paymentPrisma.$executeRawUnsafe('TRUNCATE TABLE "PaymentAttempt", "PaymentWebhookEvent", "PaymentReconciliationCase", "PaymentRefund", "Payment", "LedgerEntry", "LedgerJournal" CASCADE;');
}

export async function createPayableOrder(tag = randomUUID()) {
  const user = await paymentPrisma.user.create({ data: { email: `payment-${tag}@example.test`, role: "CUSTOMER", status: "ACTIVE", name: "Payment fixture" } });
  const quote = await paymentPrisma.pricingQuote.create({ data: {
    status: "USED", ownerType: "CUSTOMER", ownerId: user.id, deliveryType: "SAME_DAY", currency: "ZAR", calculationVersion: "phase10-fixture", inputHash: "a".repeat(64), distanceMeters: 1000,
    rawDistanceKm: "1.0000", billableDistanceKm: "1.0000", subtotal: "100.00", taxRate: "0.1500", taxAmount: "15.00", total: "115.00",
    inputSnapshot: {}, ruleSnapshot: {}, regionSnapshot: {}, taxSnapshot: {}, expiresAt: new Date("2035-01-01"), usedAt: new Date(),
  } });
  const order = await paymentPrisma.order.create({ data: {
    orderNumber: `KT-PAY-${tag.slice(0, 12)}`, source: "CUSTOMER", status: "PENDING", deliveryType: "SAME_DAY", currency: "ZAR", customerId: user.id,
    priceEstimate: "115.00", pricingQuoteId: quote.id, pricingSubtotal: "100.00", pricingTaxAmount: "15.00", pricingTaxRate: "0.1500",
    pricingSnapshot: { quoteId: quote.id, calculationVersion: quote.calculationVersion },
  } });
  return { tag, user, quote, order };
}

export const testCallbackUrls = () => ({ returnUrl: "https://app.test/payments/payfast/return?payment=pay_fixture_reference", cancelUrl: "https://app.test/payments/payfast/cancel?payment=pay_fixture_reference", notificationUrl: "https://app.test/api/payments/payfast/itn", returnRouteId: "payfast-return" as const, cancelRouteId: "payfast-cancel" as const, notificationRouteId: "payfast-itn-reserved" as const });
