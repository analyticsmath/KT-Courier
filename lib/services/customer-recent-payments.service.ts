import { prisma } from "@/lib/db/prisma";

/**
 * This is purchase/payment history, NOT a wallet balance. A provider response
 * cannot be displayed as settled without the canonical ledger receipt.
 */
export async function listCustomerRecentPayments(
  ownerUserId: string,
  requestedTake = 5,
  database: Pick<typeof prisma, "payment"> = prisma,
) {
  const take = Math.max(1, Math.min(20, Math.trunc(requestedTake)));
  const payments = await database.payment.findMany({
    where: { userId: ownerUserId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: {
      publicReference: true,
      subjectType: true,
      status: true,
      amount: true,
      successLedgerJournalId: true,
      createdAt: true,
      successfulAttempt: { select: { providerEnvironment: true } },
      attempts: {
        orderBy: { attemptNumber: "desc" },
        take: 1,
        select: { providerEnvironment: true },
      },
    },
  });
  return payments.map((row) => Object.freeze({
    reference: row.publicReference,
    description: row.subjectType === "COURIER_ORDER" ? "Parcel delivery" :
      row.subjectType === "MARKETPLACE_CHECKOUT" ? "Marketplace purchase" :
      row.subjectType === "SUBSCRIPTION_INVOICE" ? "Subscription" : "Other payment",
    amount: row.amount.toFixed(2),
    currency: "ZAR" as const,
    status: row.status === "SUCCEEDED"
      ? row.successLedgerJournalId ? "PAID" as const : "RECONCILIATION_REQUIRED" as const
      : row.status,
    environment: row.successfulAttempt?.providerEnvironment ?? row.attempts[0]?.providerEnvironment ?? "NOT_STARTED",
    createdAt: row.createdAt.toISOString(),
  }));
}
