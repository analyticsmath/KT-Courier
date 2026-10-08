import { Prisma } from "@prisma/client";
import { RefundError } from "@/lib/refunds/errors";

/** Store refunds use committed exact reversals plus the independently proved
 * unearned fee of an unstarted child. Generic refunds stay closed. */
export async function assertCommittedMarketplaceAdjustmentFunding(tx: Prisma.TransactionClient, input: { adjustmentReference: string; paymentId: string; operationId: string; amount: string; customerUserId: string | null }) {
  const invalid = () => new RefundError("REFUND_FUNDING_UNAVAILABLE", "Committed source-bound store adjustment evidence is required.");
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceStoreOrderAdjustment" WHERE "publicReference" = ${input.adjustmentReference} FOR UPDATE`);
  const adjustment = await tx.marketplaceStoreOrderAdjustment.findUnique({ where: { publicReference: input.adjustmentReference }, include: { storeOrder: { include: { marketplaceOrder: true, deliveryBridge: true, settlementSnapshots: { where: { status: "COMPLETED" }, take: 1 } } } } });
  if (!adjustment || !["APPLYING", "REFUND_PENDING", "COMPLETED"].includes(adjustment.status) || adjustment.storeOrder.marketplaceOrder.paymentId !== input.paymentId || adjustment.storeOrder.marketplaceOrder.customerUserId !== input.customerUserId || !adjustment.refundAmount.equals(input.amount)) throw invalid();
  const evidence = (adjustment.financialEvidence as Record<string, unknown> | null)?.phase21CommittedReversals as Record<string, unknown> | undefined;
  const snapshot = adjustment.storeOrder.settlementSnapshots[0];
  if (!evidence || typeof evidence.operationId !== "string" || input.operationId !== `${evidence.operationId}:refund` || typeof evidence.refundAmount !== "string" || !/^\d+\.\d{2}$/.test(evidence.refundAmount) || !new Prisma.Decimal(evidence.refundAmount).equals(input.amount) || !snapshot?.commissionAccrualReference || !snapshot.storeEarningReference || snapshot.settlementVersion !== adjustment.sourceVersion || snapshot.sourcePaymentId !== input.paymentId) throw invalid();
  const fee = adjustment.deliveryFeeAmount;
  if (fee.lessThan(0) || fee.greaterThan(adjustment.refundAmount)) throw invalid();
  if (!fee.isZero()) {
    const order = adjustment.storeOrder;
    const feeEvidence = (adjustment.financialEvidence as Record<string, unknown> | null)?.unearnedDeliveryFee as Record<string, unknown> | undefined;
    if (!["FULL_STORE_REJECTION", "CUSTOMER_CANCELLATION"].includes(adjustment.adjustmentType) || order.acceptanceStatus === "ACCEPTED" || order.preparationStatus !== "ABORTED" || order.deliveryBridge || !feeEvidence || feeEvidence.settlementSnapshotReference !== snapshot.publicReference || feeEvidence.amount !== fee.toFixed(2) || feeEvidence.preparationStatus !== "NOT_STARTED" || feeEvidence.bridgeAbsent !== true || !snapshot.deliveryFeeResidual.equals(order.deliveryFee)) throw invalid();
    if (await tx.marketplaceStoreOrderLineFulfilment.count({ where: { marketplaceStoreOrderId: order.id, handedOffQuantity: { gt: 0 } } })) throw invalid();
    const other = await tx.marketplaceStoreOrderAdjustment.findMany({ where: { marketplaceStoreOrderId: order.id, id: { not: adjustment.id }, status: { not: "REJECTED" } } });
    if (!other.reduce((total, item) => total.add(item.deliveryFeeAmount), fee).equals(snapshot.deliveryFeeResidual)) throw invalid();
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, include: { successLedgerJournal: { include: { entries: { include: { account: true } } } } } });
    const capture = payment?.successLedgerJournal;
    const capturedHeld = capture?.entries.filter(entry => entry.direction === "CREDIT" && entry.account.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR").reduce((total, entry) => total.add(entry.amount), new Prisma.Decimal(0));
    const frozen = await tx.marketplaceSettlementSnapshot.findMany({ where: { sourcePaymentId: input.paymentId } });
    if (!payment || payment.status !== "SUCCEEDED" || !capture || capture.type !== "EXTERNAL_PAYMENT_RECEIPT" || capture.currency !== "ZAR" || !capture.totalDebits.equals(payment.amount) || !capture.totalCredits.equals(payment.amount) || !capturedHeld?.equals(payment.amount) || !frozen.reduce((total, item) => total.add(item.sellerBasis).add(item.deliveryFeeResidual), new Prisma.Decimal(0)).equals(payment.amount)) throw invalid();
  }
  const commissionReferences = evidence.commissionReversalReferences;
  if (!Array.isArray(commissionReferences) || commissionReferences.some(ref => typeof ref !== "string") || (evidence.storeEarningReversalReference !== undefined && typeof evidence.storeEarningReversalReference !== "string")) throw invalid();
  const references = [...commissionReferences, ...(evidence.storeEarningReversalReference ? [evidence.storeEarningReversalReference as string] : [])];
  if ((!references.length && !adjustment.refundAmount.equals(fee)) || new Set(references).size !== references.length) throw invalid();
  const held = await tx.ledgerAccount.findUnique({ where: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" } });
  const journals = await tx.ledgerJournal.findMany({ where: { reference: { in: references } }, include: { entries: true } });
  if (!held || journals.length !== references.length) throw invalid();
  let restored = new Prisma.Decimal(0);
  for (const journal of journals) {
    const metadata = journal.metadata as Record<string, unknown> | null;
    const earningJournal = journal.reference === evidence.storeEarningReversalReference;
    if (journal.currency !== "ZAR" || !journal.totalDebits.equals(journal.totalCredits) || journal.entries.length !== 2 || typeof metadata?.operationId !== "string") throw invalid();
    if (earningJournal ? journal.type !== "STORE_EARNING_REVERSAL" || metadata.earningReference !== snapshot.storeEarningReference || metadata.operationId !== `${evidence.operationId}:store-earning` : journal.type !== "ACCOUNT_TRANSFER" || metadata.accrualReference !== snapshot.commissionAccrualReference || !metadata.operationId.startsWith(`${evidence.operationId}:commission:`)) throw invalid();
    const credits = journal.entries.filter(entry => entry.direction === "CREDIT" && entry.accountId === held.id);
    if (credits.length !== 1 || !credits[0].amount.equals(journal.totalCredits) || !credits[0].amount.greaterThan(0)) throw invalid();
    restored = restored.add(credits[0].amount);
  }
  if (!restored.add(fee).equals(input.amount)) throw invalid();
  const otherRefund = await tx.paymentRefund.findFirst({ where: { creationIdempotencyKey: `${evidence.operationId}:refund` } });
  if (otherRefund && (otherRefund.paymentId !== input.paymentId || !otherRefund.amount.equals(input.amount))) throw invalid();
}
