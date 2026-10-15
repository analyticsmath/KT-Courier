import { Prisma } from "@prisma/client";
import { storeAdjustmentChildOperation } from "@/lib/store-orders/financial-operation";
import { RefundError } from "@/lib/refunds/errors";
import { parseMarketplacePaymentPlan } from "@/lib/marketplace-checkout/payment-plan";

type CodCancellationOrder = {
  id: string; checkoutStoreGroupId: string; groupTotal: Prisma.Decimal; deliveryFee: Prisma.Decimal;
  acceptanceStatus: string; preparationStatus: string; deliveryBridge: unknown;
  checkoutStoreGroup: { id: string; checkoutId: string; fulfilmentMode: string; paymentPlan?: unknown };
  marketplaceOrder: { id: string; checkoutId: string; paymentId: string; customerUserId: string | null; grandTotal: Prisma.Decimal; digitalRequired: Prisma.Decimal; cashRequired: Prisma.Decimal };
};
type CodCancellationSnapshot = { publicReference: string; status: string; sourcePaymentId: string; sourceCheckoutId: string; sourceCheckoutStoreGroupId: string; sellerBasis: Prisma.Decimal; deliveryFeeResidual: Prisma.Decimal; commissionAccrualReference: string | null; storeEarningReference: string | null };

/** Prove an unspent deposit independently of later commercial allocations.
 * The caller holds the store-order lock; courier and cash locks serialize any
 * existing obligation with collection before cancellation may be committed. */
export async function assertUnstartedMarketplaceCodFunding(tx: Prisma.TransactionClient, order: CodCancellationOrder, snapshot: CodCancellationSnapshot) {
  const invalid = () => new RefundError("REFUND_FUNDING_UNAVAILABLE", "An exact captured deposit and unaccrued, unstarted COD order are required.");
  let plan;
  try { plan = parseMarketplacePaymentPlan(order.checkoutStoreGroup.paymentPlan); } catch { throw invalid(); }
  const parent = order.marketplaceOrder;
  if (plan.mode !== "DEPOSIT_PLUS_COD" || order.checkoutStoreGroup.fulfilmentMode !== "COURIER_DELIVERY" || order.checkoutStoreGroup.id !== order.checkoutStoreGroupId || order.checkoutStoreGroup.checkoutId !== parent.checkoutId || order.acceptanceStatus === "ACCEPTED" || !["NOT_STARTED", "ABORTED"].includes(order.preparationStatus) || order.deliveryBridge || snapshot.status !== "PENDING" || snapshot.commissionAccrualReference || snapshot.storeEarningReference || snapshot.sourcePaymentId !== parent.paymentId || snapshot.sourceCheckoutId !== parent.checkoutId || snapshot.sourceCheckoutStoreGroupId !== order.checkoutStoreGroupId || !snapshot.sellerBasis.add(snapshot.deliveryFeeResidual).equals(order.groupTotal) || !snapshot.deliveryFeeResidual.equals(order.deliveryFee) || !order.groupTotal.equals(plan.authoritativeTotal) || !parent.grandTotal.equals(order.groupTotal) || !parent.digitalRequired.equals(plan.digitalRequired) || !parent.cashRequired.equals(plan.cashRequired)) throw invalid();
  if (await tx.marketplaceStoreOrder.count({ where: { marketplaceOrderId: parent.id } }) !== 1 || await tx.marketplaceStoreOrderLineFulfilment.count({ where: { marketplaceStoreOrderId: order.id, handedOffQuantity: { gt: 0 } } })) throw invalid();
  const payment = await tx.payment.findUnique({ where: { id: parent.paymentId }, include: { successfulAttempt: true, successWebhookEvent: true, successLedgerJournal: { include: { entries: { include: { account: true } } } } } });
  const capture = payment?.successLedgerJournal, webhook = payment?.successWebhookEvent;
  const held = capture?.entries.filter(entry => entry.direction === "CREDIT" && entry.account.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR");
  const debit = capture?.entries.filter(entry => entry.direction === "DEBIT");
  const metadata = capture?.metadata as Record<string, unknown> | null;
  if (!payment || payment.subjectType !== "MARKETPLACE_CHECKOUT" || payment.marketplaceCheckoutId !== parent.checkoutId || payment.marketplaceOrderId !== parent.id || payment.userId !== parent.customerUserId || payment.status !== "SUCCEEDED" || payment.currency !== "ZAR" || !["CLEAR", "RESOLVED"].includes(payment.reconciliationStatus) || !payment.amount.equals(plan.digitalRequired) || payment.successfulAttempt?.status !== "SUCCEEDED" || !webhook || webhook.processingStatus !== "APPLIED" || !webhook.signatureVerified || !webhook.merchantVerified || !webhook.amountVerified || !webhook.providerDataVerified || !capture || capture.type !== "EXTERNAL_PAYMENT_RECEIPT" || capture.currency !== "ZAR" || metadata?.paymentReference !== payment.publicReference || !capture.totalDebits.equals(payment.amount) || !capture.totalCredits.equals(payment.amount) || capture.entries.length !== 2 || held?.length !== 1 || debit?.length !== 1 || !held[0].amount.equals(payment.amount) || !debit[0].amount.equals(payment.amount)) throw invalid();
  const obligations = await tx.cashOnDelivery.findMany({ where: { paymentId: parent.paymentId }, orderBy: { id: "asc" } });
  if (obligations.length > 1) throw invalid();
  for (const obligation of obligations) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${obligation.orderId} FOR UPDATE`);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CashOnDelivery" WHERE "id" = ${obligation.id} FOR UPDATE`);
    const cash = await tx.cashOnDelivery.findUniqueOrThrow({ where: { id: obligation.id } });
    if (!["PENDING", "READY_FOR_COLLECTION", "CANCELLED"].includes(cash.status) || cash.paymentId !== parent.paymentId || cash.policyMode !== "DEPOSIT_PLUS_COD" || !cash.authoritativePayable.equals(plan.authoritativeTotal) || !cash.digitalRequired.equals(plan.digitalRequired) || !cash.digitalPaid.equals(plan.digitalRequired) || !cash.cashObligation.equals(plan.cashRequired) || !cash.cashCollected.isZero() || !cash.cashReconciled.isZero() || cash.collectionJournalId || cash.reconciliationJournalId || cash.collectionOperationId || cash.collectedAt || cash.reconciledAt || cash.suspenseJournalId || cash.adjustmentJournalId) throw invalid();
  }
  return { version: "unstarted-marketplace-cod-v1", settlementSnapshotReference: snapshot.publicReference, checkoutStoreGroupId: order.checkoutStoreGroupId, paymentId: parent.paymentId, paymentReference: payment.publicReference, captureJournalId: capture.id, digitalRequired: plan.digitalRequired, cashCancelled: plan.cashRequired, authoritativeTotal: plan.authoritativeTotal, cashObligationId: obligations[0]?.id ?? null };
}

/** Store refunds use committed exact reversals plus the independently proved
 * unearned fee of an unstarted child. Generic refunds stay closed. */
export async function assertCommittedMarketplaceAdjustmentFunding(tx: Prisma.TransactionClient, input: { adjustmentReference: string; paymentId: string; operationId: string; amount: string; customerUserId: string | null }) {
  const invalid = () => new RefundError("REFUND_FUNDING_UNAVAILABLE", "Committed source-bound store adjustment evidence is required.");
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceStoreOrderAdjustment" WHERE "publicReference" = ${input.adjustmentReference} FOR UPDATE`);
  const adjustment = await tx.marketplaceStoreOrderAdjustment.findUnique({ where: { publicReference: input.adjustmentReference }, include: { storeOrder: { include: { marketplaceOrder: true, checkoutStoreGroup: true, deliveryBridge: true, settlementSnapshots: { orderBy: { createdAt: "asc" }, take: 1 } } } } });
  if (!adjustment || !["APPLYING", "REFUND_PENDING", "COMPLETED"].includes(adjustment.status) || adjustment.storeOrder.marketplaceOrder.paymentId !== input.paymentId || adjustment.storeOrder.marketplaceOrder.customerUserId !== input.customerUserId || !adjustment.refundAmount.equals(input.amount)) throw invalid();
  const evidence = (adjustment.financialEvidence as Record<string, unknown> | null)?.phase21CommittedReversals as Record<string, unknown> | undefined;
  const snapshot = adjustment.storeOrder.settlementSnapshots[0];
  const codEvidence = (adjustment.financialEvidence as Record<string, unknown> | null)?.unstartedCodCancellation;
  if (codEvidence) {
    if (!snapshot || !evidence || typeof evidence.operationId !== "string" || input.operationId !== storeAdjustmentChildOperation(evidence.operationId, "refund") || evidence.fundingSource !== "UNSTARTED_COD_DEPOSIT" || evidence.refundAmount !== input.amount || !["FULL_STORE_REJECTION", "CUSTOMER_CANCELLATION"].includes(adjustment.adjustmentType) || !adjustment.deliveryFeeAmount.isZero() || adjustment.storeOrder.preparationStatus !== "ABORTED" || snapshot.settlementVersion !== adjustment.sourceVersion || !Array.isArray(evidence.commissionReversalReferences) || evidence.commissionReversalReferences.length || evidence.storeEarningReversalReference) throw invalid();
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceStoreOrder" WHERE "id" = ${adjustment.storeOrder.id} FOR UPDATE`);
    const proof = await assertUnstartedMarketplaceCodFunding(tx, adjustment.storeOrder, snapshot);
    if (!Object.entries(proof).every(([key, value]) => (codEvidence as Record<string, unknown>)[key] === value) || proof.digitalRequired !== input.amount || evidence.captureJournalId !== proof.captureJournalId || evidence.paymentReference !== proof.paymentReference || evidence.customerUserId !== input.customerUserId) throw invalid();
    const other = await tx.marketplaceStoreOrderAdjustment.count({ where: { marketplaceStoreOrderId: adjustment.storeOrder.id, id: { not: adjustment.id }, status: { not: "REJECTED" } } });
    const job = await tx.marketplaceStoreSettlementJob.findFirst({ where: { marketplaceStoreOrderId: adjustment.storeOrder.id, settlementSnapshotId: snapshot.id } });
    const cash = proof.cashObligationId ? await tx.cashOnDelivery.findUniqueOrThrow({ where: { id: proof.cashObligationId } }) : null;
    if (other || job?.status !== "COMPLETED" || job.lastSafeError !== "UNSTARTED_COD_CANCELLED" || cash && cash.status !== "CANCELLED") throw invalid();
    return;
  }
  if (!evidence || typeof evidence.operationId !== "string" || input.operationId !== storeAdjustmentChildOperation(evidence.operationId, "refund") || typeof evidence.refundAmount !== "string" || !/^\d+\.\d{2}$/.test(evidence.refundAmount) || !new Prisma.Decimal(evidence.refundAmount).equals(input.amount) || snapshot?.status !== "COMPLETED" || !snapshot.commissionAccrualReference || !snapshot.storeEarningReference || snapshot.settlementVersion !== adjustment.sourceVersion || snapshot.sourcePaymentId !== input.paymentId) throw invalid();
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
    if (earningJournal ? journal.type !== "STORE_EARNING_REVERSAL" || metadata.earningReference !== snapshot.storeEarningReference || metadata.operationId !== storeAdjustmentChildOperation(evidence.operationId, "store-earning") : journal.type !== "ACCOUNT_TRANSFER" || metadata.accrualReference !== snapshot.commissionAccrualReference || typeof metadata.allocationReference !== "string" || metadata.operationId !== storeAdjustmentChildOperation(evidence.operationId, "commission", metadata.allocationReference)) throw invalid();
    const credits = journal.entries.filter(entry => entry.direction === "CREDIT" && entry.accountId === held.id);
    if (credits.length !== 1 || !credits[0].amount.equals(journal.totalCredits) || !credits[0].amount.greaterThan(0)) throw invalid();
    restored = restored.add(credits[0].amount);
  }
  if (!restored.add(fee).equals(input.amount)) throw invalid();
  const otherRefund = await tx.paymentRefund.findFirst({ where: { creationIdempotencyKey: storeAdjustmentChildOperation(evidence.operationId, "refund") } });
  if (otherRefund && (otherRefund.paymentId !== input.paymentId || !otherRefund.amount.equals(input.amount))) throw invalid();
}
