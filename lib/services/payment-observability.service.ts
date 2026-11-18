import { prisma } from "@/lib/db/prisma";

export type PaymentObservabilitySnapshot = Readonly<{
  generatedAt: string;
  pendingPaystackWebhooks: number;
  failedPaystackWebhooks: number;
  oldestPendingWebhookAgeSeconds: number | null;
  unresolvedPaystackAttempts: number;
  openPaymentReconciliationCases: number;
  pendingParcelOrdersWithinWindow: number;
  pendingParcelOrdersOverdue: number;
}>;

/**
 * Read-only, secret-free payment, webhook lag, reconciliation, and unpaid
 * parcel expiry backlog counters for admin operations observability.
 */
export async function getPaymentObservabilitySnapshot(now = new Date()): Promise<PaymentObservabilitySnapshot> {
  const [
    pendingPaystackWebhooks,
    failedPaystackWebhooks,
    oldestPendingWebhook,
    unresolvedPaystackAttempts,
    openPaymentReconciliationCases,
    pendingParcelOrdersWithinWindow,
    pendingParcelOrdersOverdue,
  ] = await Promise.all([
    prisma.paymentWebhookEvent.count({
      where: { provider: "PAYSTACK", processingStatus: { in: ["RECEIVED", "PROCESSING"] } },
    }),
    prisma.paymentWebhookEvent.count({
      where: { provider: "PAYSTACK", processingStatus: { in: ["TEMPORARY_FAILURE", "REJECTED"] } },
    }),
    prisma.paymentWebhookEvent.findFirst({
      where: { provider: "PAYSTACK", processingStatus: { in: ["RECEIVED", "PROCESSING"] } },
      orderBy: [{ receivedAt: "asc" }],
      select: { receivedAt: true },
    }),
    prisma.paymentAttempt.count({
      where: { provider: "PAYSTACK", status: { in: ["REQUIRES_ACTION", "PROCESSING", "UNKNOWN"] } },
    }),
    prisma.paymentReconciliationCase.count({
      where: { status: "OPEN" },
    }),
    prisma.order.count({
      where: {
        status: "PENDING",
        marketplaceStoreOrderBridge: { is: null },
        paymentDueAt: { gt: now },
      },
    }),
    prisma.order.count({
      where: {
        status: "PENDING",
        marketplaceStoreOrderBridge: { is: null },
        paymentDueAt: { lte: now },
      },
    }),
  ]);

  const oldestPendingWebhookAgeSeconds = oldestPendingWebhook
    ? Math.max(0, Math.floor((now.getTime() - oldestPendingWebhook.receivedAt.getTime()) / 1000))
    : null;

  return Object.freeze({
    generatedAt: now.toISOString(),
    pendingPaystackWebhooks,
    failedPaystackWebhooks,
    oldestPendingWebhookAgeSeconds,
    unresolvedPaystackAttempts,
    openPaymentReconciliationCases,
    pendingParcelOrdersWithinWindow,
    pendingParcelOrdersOverdue,
  });
}
