import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { loadCustomerRewardPolicy } from "@/lib/rewards/customer-reward-configuration";
import { earnedCustomerPoints } from "@/lib/rewards/customer-reward-policy";
import { reconcileLoyaltyPointBalance } from "@/lib/rewards/customer-loyalty-reconciliation";

/** Reconcile trusted, completed parcel payments into NON-MONETARY points.
 * Caller supplies identifiers only; money, refund, webhook and ledger
 * evidence are resolved and locked in PostgreSQL, never accepted from HTTP.
 * This does not authorize wallet credits or points redemption.
 */
export async function reconcileCompletedParcelLoyalty(customerUserId: string, paymentId: string) {
  if (!customerUserId || !paymentId) throw new Error("Loyalty reconciliation requires verified source IDs.");
  return withLedgerRetry(() => prisma.$transaction(async tx => {
    const userRows = await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${customerUserId} FOR UPDATE`);
    if (userRows.length !== 1) throw new Error("Customer loyalty owner is not valid.");
    const customer = await tx.user.findUniqueOrThrow({
      where: { id: customerUserId }, select: { role: true, status: true },
    });
    if (customer.role !== "CUSTOMER" || customer.status !== "ACTIVE") throw new Error("Customer loyalty owner is not eligible.");

    const paymentRows = await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`);
    if (paymentRows.length !== 1) throw new Error("Payment evidence is unavailable.");
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        order: true,
        successWebhookEvent: true,
        successLedgerJournal: {
          include: { entries: { include: { account: { select: { code: true, purpose: true, category: true } } } } },
        },
        successfulAttempt: true,
      },
    });
    if (payment.subjectType !== "COURIER_ORDER" || !payment.order
      || payment.order.customerId !== customerUserId || payment.order.id !== payment.orderId
      || payment.currency !== "ZAR") throw new Error("Parcel payment ownership evidence is invalid.");

    const journal = payment.successLedgerJournal;
    const webhook = payment.successWebhookEvent;
    const totalEntryAmount = (direction: "DEBIT" | "CREDIT") => journal?.entries
      .filter(entry => entry.direction === direction)
      .reduce((total, entry) => total.plus(entry.amount), new Prisma.Decimal(0)) ?? new Prisma.Decimal(0);
    const hasHeldCredit = journal?.entries.some(entry => entry.direction === "CREDIT"
      && entry.account.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR"
      && entry.account.category === "LIABILITY");
    const attempt = payment.successfulAttempt;
    if (payment.status !== "SUCCEEDED" || !payment.providerConfirmedAt || !payment.succeededAt
      || !journal || journal.type !== "EXTERNAL_PAYMENT_RECEIPT"
      || journal.currency !== payment.currency || journal.correlationId !== payment.publicReference
      || !journal.totalDebits.equals(payment.amount) || !journal.totalCredits.equals(payment.amount)
      || !totalEntryAmount("DEBIT").equals(payment.amount) || !totalEntryAmount("CREDIT").equals(payment.amount)
      || !hasHeldCredit
      || !webhook || webhook.paymentId !== paymentId || webhook.processingStatus !== "APPLIED"
      || webhook.provider !== payment.provider || !webhook.sourceAddressVerified
      || !webhook.signatureVerified || !webhook.merchantVerified || !webhook.amountVerified || !webhook.providerDataVerified
      || !attempt || attempt.paymentId !== paymentId || attempt.status !== "SUCCEEDED"
      || attempt.provider !== payment.provider || !attempt.amount.equals(payment.amount)
      || attempt.currency !== payment.currency || webhook.merchantReference !== attempt.merchantReference
      || !payment.order.pricingTaxAmount) {
      throw new Error("Verified payment, immutable ledger receipt or tax evidence is incomplete.");
    }

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${payment.order.id} FOR UPDATE`);
    const order = await tx.order.findUniqueOrThrow({
      where: { id: payment.order.id }, select: { status: true, pricingTaxAmount: true },
    });
    if (!order.pricingTaxAmount) throw new Error("Original parcel tax snapshot is missing.");
    const completed = order.status === "DELIVERED" || order.status === "COMPLETED";

    // Includes refund reservations so an in-flight refund does not temporarily
    // create redeemable points; replay after refund confirmation/release.
    const refunded = payment.totalRefundedAmount.add(payment.totalRefundReservedAmount);
    const prior = await tx.customerLoyaltyEarning.findUnique({ where: { paymentId } });
    if (prior && prior.userId !== customerUserId) throw new Error("Loyalty source belongs to a different customer.");
    const pointsPerZar = prior?.pointsPerZar ?? (await loadCustomerRewardPolicy(tx)).pointsPerZar;
    const expected = earnedCustomerPoints({
      providerPaidZar: payment.amount.toFixed(2),
      vatZar: order.pricingTaxAmount.toFixed(2),
      refundedProviderZar: refunded.toFixed(2),
      paymentVerified: true, orderCompleted: completed, pointsPerZar,
    });
    if (expected > 9223372036854775807n) throw new Error("Loyalty award exceeds BIGINT range.");

    const account = await tx.customerLoyaltyAccount.findUnique({ where: { userId: customerUserId } });
    if (!prior && expected === 0n) return { status: "NOT_ELIGIBLE" as const, recognizedPoints: "0", availablePoints: (account?.availablePoints ?? 0n).toString(), debtPoints: (account?.debtPoints ?? 0n).toString(), revision: 0 };
    if (prior && prior.recognizedPoints === expected) return { status: "REPLAYED" as const, recognizedPoints: expected.toString(), availablePoints: (account?.availablePoints ?? 0n).toString(), debtPoints: (account?.debtPoints ?? 0n).toString(), revision: prior.revision };
    const current = account ?? await tx.customerLoyaltyAccount.create({ data: { userId: customerUserId } });
    const next = reconcileLoyaltyPointBalance({
      balance: {
        availablePoints: current.availablePoints, debtPoints: current.debtPoints,
        lifetimeEarnedPoints: current.lifetimeEarnedPoints, lifetimeReversedPoints: current.lifetimeReversedPoints,
      },
      previouslyRecognizedPoints: prior?.recognizedPoints ?? 0n,
      recomputedRecognizedPoints: expected,
    });
    const revision = (prior?.revision ?? 0) + 1;
    const data = {
      recognizedPoints: expected, pointsPerZar,
      eligibleBasisAmount: payment.amount.sub(order.pricingTaxAmount).sub(refunded),
      vatAmount: order.pricingTaxAmount, refundedAmount: refunded, revision,
    };
    if (prior) await tx.customerLoyaltyEarning.update({ where: { paymentId }, data });
    else await tx.customerLoyaltyEarning.create({ data: { paymentId, userId: customerUserId, ...data } });
    await tx.customerLoyaltyAccount.update({
      where: { userId: customerUserId }, data: {
        availablePoints: next.availablePoints, debtPoints: next.debtPoints,
        lifetimeEarnedPoints: next.lifetimeEarnedPoints,
        lifetimeReversedPoints: next.lifetimeReversedPoints,
        version: { increment: 1 },
      },
    });
    await tx.customerLoyaltyMovement.create({ data: {
      userId: customerUserId, paymentId, revision, deltaPoints: next.deltaPoints,
      availablePointsAfter: next.availablePoints, debtPointsAfter: next.debtPoints,
      policySnapshot: {
        pointsPerZar, verifiedPaymentReference: payment.publicReference,
        originalOrderReference: payment.order.orderNumber,
        digitalPaidZar: payment.amount.toFixed(2),
        vatZar: order.pricingTaxAmount.toFixed(2),
        settledOrReservedRefundZar: refunded.toFixed(2), completed,
      },
    } });
    return {
      status: next.deltaPoints > 0n ? "AWARDED" as const : "REVERSED" as const,
      recognizedPoints: expected.toString(),
      availablePoints: next.availablePoints.toString(),
      debtPoints: next.debtPoints.toString(), revision,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
}
