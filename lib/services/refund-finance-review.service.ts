import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { assertRefundApprovalControl } from "@/lib/refunds/refund-dual-control";
import { RefundError } from "@/lib/refunds/errors";
import { assertRefundOperationId, sanitizeRefundNote } from "@/lib/refunds/refund-note-policy";
import { assertRefundTransition } from "@/lib/refunds/refund-state-machine";
import { rejectRefundRequest } from "./refund-request.service";

async function lockRefund(tx: Prisma.TransactionClient, publicReference: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "PaymentRefund" WHERE "publicReference" = ${publicReference} FOR UPDATE`);
  if (rows.length !== 1) throw new RefundError("REFUND_NOT_FOUND", "Refund request was not found.");
  const refund = await tx.paymentRefund.findUnique({ where: { id: rows[0].id }, include: { payment: { include: { successfulAttempt: { select: { status: true, providerReference: true } } } }, fundingAllocations: true } });
  if (!refund) throw new RefundError("REFUND_NOT_FOUND", "Refund request was not found.");
  return refund;
}

function assertDecisionCoherence(refund: Awaited<ReturnType<typeof lockRefund>>): void {
  const fundingTotal = refund.fundingAllocations.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
  if (!refund.reserveLedgerJournalId || refund.releaseLedgerJournalId || refund.completionLedgerJournalId || !fundingTotal.equals(refund.amount)) {
    throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund reservation evidence is not coherent for finance review.");
  }
  if (refund.payment.status !== "SUCCEEDED" || refund.payment.currency !== "ZAR") {
    throw new RefundError("REFUND_PAYMENT_INELIGIBLE", "Payment is no longer valid refund evidence.");
  }
  if (refund.method === "ORIGINAL_PAYMENT_METHOD" && (!refund.payment.provider || !refund.payment.successfulAttempt?.providerReference)) {
    throw new RefundError("REFUND_PROVIDER_UNSUPPORTED", "Original payment method no longer has provider refund evidence.");
  }
}

export async function beginRefundReview(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string }>) {
  const operationId = assertRefundOperationId(input.operationId);
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const refund = await lockRefund(tx, input.publicReference);
    const replay = await tx.refundStatusHistory.findUnique({ where: { refundId_operationId: { refundId: refund.id, operationId } } });
    if (replay) {
      if (replay.toStatus === "UNDER_REVIEW") return refund;
      throw new RefundError("REFUND_IDEMPOTENCY_CONFLICT", "Operation ID belongs to another refund transition.");
    }
    if (refund.customerUserId === input.actorUserId) throw new RefundError("REFUND_DUAL_CONTROL_REQUIRED", "Customer requester cannot review their own refund administratively.");
    assertRefundTransition(refund.status, "UNDER_REVIEW");
    assertDecisionCoherence(refund);
    const updated = await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: "UNDER_REVIEW", version: { increment: 1 } } });
    await tx.refundStatusHistory.create({ data: { refundId: refund.id, fromStatus: refund.status, toStatus: "UNDER_REVIEW", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, operationId, reasonCode: "FINANCE_REVIEW_STARTED" } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function approveRefund(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string; financeNote?: string }>) {
  const operationId = assertRefundOperationId(input.operationId);
  const financeNote = sanitizeRefundNote(input.financeNote);
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const refund = await lockRefund(tx, input.publicReference);
    const replay = await tx.refundStatusHistory.findUnique({ where: { refundId_operationId: { refundId: refund.id, operationId } } });
    if (replay) {
      if (replay.toStatus === "APPROVED") return refund;
      throw new RefundError("REFUND_IDEMPOTENCY_CONFLICT", "Operation ID belongs to another refund transition.");
    }
    assertRefundApprovalControl({ customerUserId: refund.customerUserId ?? "", approverUserId: input.actorUserId });
    assertRefundTransition(refund.status, "APPROVED");
    assertDecisionCoherence(refund);
    const updated = await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: "APPROVED", approvedByUserId: input.actorUserId, approvedAt: new Date(), financeNote, version: { increment: 1 } } });
    await tx.refundStatusHistory.create({ data: { refundId: refund.id, fromStatus: refund.status, toStatus: "APPROVED", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, operationId, reasonCode: "FINANCE_APPROVED" } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export function rejectRefund(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string; financeNote?: string }>) {
  return rejectRefundRequest(input);
}
