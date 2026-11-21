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
import { projectMarketplaceRefundCompletion } from "./marketplace-refund-completion.service";
import {
  emitAdminAlertNonBlocking,
  recordAdminAlertIntentInTx,
  type AdminAlertEventInput,
} from "@/lib/notifications/admin-alert-dispatch.service";

export async function completeRefundToCustomerWallet(input: Readonly<{
  actorUserId: string;
  publicReference: string;
  operationId: string;
}>, dependencies: Readonly<{ assertProductionReady?: () => void }> = {}) {
  (dependencies.assertProductionReady ?? (() => assertRefundProductionActivation("WALLET_COMPLETION")))();
  const operationId = assertRefundOperationId(input.operationId);
  let pendingAlert: AdminAlertEventInput | null = null;
  const completed = await withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "PaymentRefund" WHERE "publicReference" = ${input.publicReference} FOR UPDATE`);
    if (rows.length !== 1) throw new RefundError("REFUND_NOT_FOUND", "Refund request was not found.");
    const refund = await tx.paymentRefund.findUnique({ where: { id: rows[0].id }, include: { payment: true, beneficiaryStore: { select: { ownerUserId: true } }, statusHistory: { where: { toStatus: "REQUESTED" }, select: { actorUserId: true }, take: 2 }, reserveLedgerJournal: { include: { entries: { select: { accountId: true, direction: true, amount: true } } } } } });
    if (!refund) throw new RefundError("REFUND_NOT_FOUND", "Refund request was not found.");
    if (refund.beneficiaryStore?.ownerUserId === input.actorUserId || refund.statusHistory.some((h) => h.actorUserId === input.actorUserId)) {
      throw new RefundError("REFUND_DUAL_CONTROL_REQUIRED", "Refund requester or beneficiary store owner cannot complete wallet refund.");
    }
    assertRefundCompletionControl({ customerUserId: refund.customerUserId ?? "", approvedByUserId: refund.approvedByUserId, completedByUserId: input.actorUserId });
    const replay = await tx.refundStatusHistory.findUnique({ where: { refundId_operationId: { refundId: refund.id, operationId } } });
    if (replay) {
      if (replay.toStatus === "SUCCEEDED" && refund.status === "SUCCEEDED" && replay.actorUserId === input.actorUserId) return refund;
      throw new RefundError("REFUND_IDEMPOTENCY_CONFLICT", "Operation ID belongs to another refund transition.");
    }
    if ((!refund.customerUserId && !refund.beneficiaryStoreId) || refund.method !== "CUSTOMER_WALLET" || refund.status !== "APPROVED") throw new RefundError("REFUND_INVALID_STATE", "Only approved authenticated customer-wallet or store-wallet refunds can be completed internally.");
    assertRefundCompletionControl({ customerUserId: refund.customerUserId ?? "", approvedByUserId: refund.approvedByUserId, completedByUserId: input.actorUserId });
    assertRefundTransition(refund.status, "SUCCEEDED");
    if (refund.releaseLedgerJournalId || refund.completionLedgerJournalId || !refund.reserveLedgerJournalId) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund financial evidence is not coherent for wallet completion.");
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${refund.paymentId} FOR UPDATE`);
    const accounts = refund.beneficiaryStoreId
      ? await tx.ledgerAccount.findMany({ where: { currency: "ZAR", purpose: { in: ["CUSTOMER_REFUND_HELD", "STORE_REFERRAL_WALLET_AVAILABLE"] }, wallet: { ownerType: "STORE", ownerId: refund.beneficiaryStoreId, status: "ACTIVE" } }, orderBy: { id: "asc" } })
      : await tx.ledgerAccount.findMany({ where: { currency: "ZAR", purpose: { in: ["CUSTOMER_REFUND_HELD", "CUSTOMER_WALLET_AVAILABLE"] }, wallet: { ownerType: "CUSTOMER", ownerId: refund.customerUserId ?? undefined, status: "ACTIVE" } }, orderBy: { id: "asc" } });
    const held = accounts.find((account) => account.purpose === "CUSTOMER_REFUND_HELD");
    const available = accounts.find((account) =>
      refund.beneficiaryStoreId
        ? account.purpose === "STORE_REFERRAL_WALLET_AVAILABLE"
        : account.purpose === "CUSTOMER_WALLET_AVAILABLE",
    );
    if (!held || !available || held.category !== "LIABILITY" || available.category !== "LIABILITY" || held.allowNegative || available.allowNegative) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Wallet accounts are invalid for refund completion.");
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
    await projectMarketplaceRefundCompletion(tx, refund.id);
    await tx.refundReconciliationCase.updateMany({ where: { refundId: refund.id, status: { in: ["OPEN", "MONITORING"] } }, data: { status: "RESOLVED", resolvedAt: now, resolutionCode: "WALLET_CREDIT_COMPLETED", resolvedByUserId: input.actorUserId } });
    await tx.refundStatusHistory.create({ data: { refundId: refund.id, fromStatus: refund.status, toStatus: "SUCCEEDED", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, operationId, reasonCode: "WALLET_CREDIT_SUCCEEDED", safeMetadata: { completionJournalReference: journal.reference } } });
    pendingAlert = {
      eventType: "REFUND_COMPLETED",
      aggregateReference: `refund-comp:${refund.publicReference}`,
      adminPath: `/admin/refunds/${refund.id}`,
      relatedOrderId: refund.payment.orderId ?? undefined,
      title: `Refund completed (${refund.publicReference})`,
      summary: `Wallet refund ${refund.publicReference} settled for R${refund.amount.toFixed(2)}.`,
      metadata: {
        refundPublicReference: refund.publicReference,
        paymentPublicReference: refund.payment.publicReference,
        amountZar: refund.amount.toFixed(2),
        method: refund.method,
        completionJournalReference: journal.reference,
        ...(refund.payment.orderId ? { orderId: refund.payment.orderId } : {}),
        ...(refund.beneficiaryStoreId ? { beneficiaryStoreId: refund.beneficiaryStoreId } : {}),
      },
    };
    await recordAdminAlertIntentInTx(tx, pendingAlert);
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  if (pendingAlert) {
    void emitAdminAlertNonBlocking(pendingAlert);
  }
  return completed;
}
