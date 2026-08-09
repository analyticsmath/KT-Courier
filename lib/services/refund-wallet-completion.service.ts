import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LedgerMoney } from "@/lib/ledger/money";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { assertRefundCompletionControl } from "@/lib/refunds/refund-dual-control";
import { RefundError } from "@/lib/refunds/errors";
import { assertRefundReserveJournalEvidence } from "@/lib/refunds/refund-ledger-evidence";
import { refundWalletCreditPosting } from "@/lib/refunds/refund-ledger-policy";
import { assertRefundOperationId } from "@/lib/refunds/refund-note-policy";
import { assertRefundProductionActivation } from "@/lib/refunds/refund-production-readiness";
import { assertRefundTransition } from "@/lib/refunds/refund-state-machine";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";
import { completeStoreEarningRefundProjectionsWithinTransaction } from "./store-earning-refund.service";
import { completeDriverEarningRefundProjectionsWithinTransaction } from "./driver-earning-refund.service";

export async function completeRefundToCustomerWallet(input: Readonly<{
  actorUserId: string;
  publicReference: string;
  operationId: string;
}>, dependencies: Readonly<{ assertProductionReady?: () => void }> = {}) {
  (dependencies.assertProductionReady ?? assertRefundProductionActivation)();
  const operationId = assertRefundOperationId(input.operationId);
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "PaymentRefund" WHERE "publicReference" = ${input.publicReference} FOR UPDATE`);
    if (rows.length !== 1) throw new RefundError("REFUND_NOT_FOUND", "Refund request was not found.");
    const refund = await tx.paymentRefund.findUnique({ where: { id: rows[0].id }, include: { payment: true, reserveLedgerJournal: { include: { entries: { select: { accountId: true, direction: true, amount: true } } } } } });
    if (!refund) throw new RefundError("REFUND_NOT_FOUND", "Refund request was not found.");
    const replay = await tx.refundStatusHistory.findUnique({ where: { refundId_operationId: { refundId: refund.id, operationId } } });
    if (replay) {
      if (replay.toStatus === "SUCCEEDED" && refund.status === "SUCCEEDED") return refund;
      throw new RefundError("REFUND_IDEMPOTENCY_CONFLICT", "Operation ID belongs to another refund transition.");
    }
    if (refund.method !== "CUSTOMER_WALLET" || refund.status !== "APPROVED") throw new RefundError("REFUND_INVALID_STATE", "Only approved customer-wallet refunds can be completed internally.");
    assertRefundCompletionControl({ customerUserId: refund.customerUserId ?? "", approvedByUserId: refund.approvedByUserId, completedByUserId: input.actorUserId });
    assertRefundTransition(refund.status, "SUCCEEDED");
    if (refund.releaseLedgerJournalId || refund.completionLedgerJournalId || !refund.reserveLedgerJournalId) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund financial evidence is not coherent for wallet completion.");
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${refund.paymentId} FOR UPDATE`);
    const accounts = await tx.ledgerAccount.findMany({ where: { currency: "ZAR", purpose: { in: ["CUSTOMER_REFUND_HELD", "CUSTOMER_WALLET_AVAILABLE"] }, wallet: { ownerType: "CUSTOMER", ownerId: refund.customerUserId ?? undefined, status: "ACTIVE" } }, orderBy: { id: "asc" } });
    const held = accounts.find((account) => account.purpose === "CUSTOMER_REFUND_HELD");
    const available = accounts.find((account) => account.purpose === "CUSTOMER_WALLET_AVAILABLE");
    if (!held || !available || held.category !== "LIABILITY" || available.category !== "LIABILITY" || held.allowNegative || available.allowNegative) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Customer wallet accounts are invalid.");
    const accountIds = [held.id, available.id].sort();
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(accountIds)}) ORDER BY "id" ASC FOR UPDATE`);
    if (locked.length !== 2) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Customer wallet accounts could not be locked.");
    assertRefundReserveJournalEvidence({ refundAmount: refund.amount, heldAccountId: held.id, journal: refund.reserveLedgerJournal });
    const heldAfterLock = await tx.ledgerAccount.findUnique({ where: { id: held.id } });
    if (!heldAfterLock || LedgerMoney.fromDecimal(heldAfterLock.currentBalance).lessThan(LedgerMoney.fromDecimal(refund.amount))) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund-held liability does not cover wallet completion.");
    const journal = await postLedgerJournalWithinTransaction(tx, refundWalletCreditPosting({ refundReference: refund.publicReference, paymentReference: refund.payment.publicReference, amount: refund.amount.toFixed(2), heldAccountId: held.id, walletAvailableAccountId: available.id, actorUserId: input.actorUserId }));
    const projection = await tx.payment.updateMany({ where: { id: refund.paymentId, version: refund.payment.version, totalRefundReservedAmount: { gte: refund.amount } }, data: { totalRefundReservedAmount: { decrement: refund.amount }, totalRefundedAmount: { increment: refund.amount }, version: { increment: 1 } } });
    if (projection.count !== 1) throw new RefundError("REFUND_CONCURRENCY_CONFLICT", "Wallet refund completion lost a concurrent payment update.", true);
    const now = new Date();
    await completeStoreEarningRefundProjectionsWithinTransaction(tx, { refundId: refund.id, refundPublicReference: refund.publicReference, actorUserId: input.actorUserId });
    await completeDriverEarningRefundProjectionsWithinTransaction(tx, { refundId: refund.id, refundPublicReference: refund.publicReference, actorUserId: input.actorUserId });
    const updated = await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: "SUCCEEDED", completionLedgerJournalId: journal.id, completedByUserId: input.actorUserId, completedAt: now, reconciliationRequiredAt: null, version: { increment: 1 } } });
    await tx.refundReconciliationCase.updateMany({ where: { refundId: refund.id, status: { in: ["OPEN", "MONITORING"] } }, data: { status: "RESOLVED", resolvedAt: now, resolutionCode: "WALLET_CREDIT_COMPLETED", resolvedByUserId: input.actorUserId } });
    await tx.refundStatusHistory.create({ data: { refundId: refund.id, fromStatus: refund.status, toStatus: "SUCCEEDED", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, operationId, reasonCode: "WALLET_CREDIT_SUCCEEDED", safeMetadata: { completionJournalReference: journal.reference } } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
