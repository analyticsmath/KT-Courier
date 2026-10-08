import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { RefundError } from "@/lib/refunds/errors";
import { deriveStoreOrderStatus } from "@/lib/store-orders/state-machine";

/** Project only a journal-backed successful refund inside its transaction.
 * This does not enable a processor or external financial operation. */
export async function projectMarketplaceRefundCompletion(tx: Prisma.TransactionClient, refundId: string) {
  const adjustments = await tx.marketplaceStoreOrderAdjustment.findMany({ where: { refundId, status: "REFUND_PENDING" }, include: { allocations: true, storeOrder: { include: { marketplaceOrder: true } } } });
  if (!adjustments.length) return;
  if (adjustments.length !== 1) throw new RefundError("REFUND_LEDGER_INCOHERENT", "One completed refund must identify one original store adjustment.");
  const refund = await tx.paymentRefund.findUnique({ where: { id: refundId }, include: { completionLedgerJournal: true } });
  if (!refund || refund.status !== "SUCCEEDED" || !refund.completedAt || !refund.completionLedgerJournal || !["REFUND_EXTERNAL_PAYOUT", "REFUND_WALLET_CREDIT"].includes(refund.completionLedgerJournal.type) || !refund.completionLedgerJournal.totalDebits.equals(refund.amount) || !refund.completionLedgerJournal.totalCredits.equals(refund.amount)) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Store fulfilment cannot resolve without a completed refund journal.");
  for (const adjustment of adjustments) {
    const order = adjustment.storeOrder;
    if (order.marketplaceOrder.paymentId !== refund.paymentId || order.marketplaceOrder.customerUserId !== refund.customerUserId || !adjustment.refundAmount.equals(refund.amount)) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Store adjustment does not match its completed original payment refund.");
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceStoreOrder" WHERE "id" = ${order.id} FOR UPDATE`);
    await tx.marketplaceStoreOrderAdjustment.update({ where: { id: adjustment.id }, data: { status: "COMPLETED", completedAt: refund.completedAt } });
    const issueReference = (adjustment.financialEvidence as Record<string, unknown> | null)?.issueReference;
    if (typeof issueReference === "string") await tx.marketplaceStoreOrderIssue.updateMany({ where: { marketplaceStoreOrderId: order.id, publicReference: issueReference, status: "REFUND_PENDING" }, data: { status: "RESOLVED", resolvedAt: refund.completedAt, version: { increment: 1 } } });
    await tx.marketplaceStoreOrderReconciliationCase.updateMany({ where: { marketplaceStoreOrderId: order.id, reasonCode: "FINANCIAL_COMPOSITION_FAILED", status: "OPEN", OR: [{ adjustmentId: adjustment.id }, { safeEvidence: { path: ["adjustmentReference"], equals: adjustment.publicReference } }] }, data: { status: "RESOLVED", resolvedAt: refund.completedAt, resolutionCode: "BOUND_REFUND_COMPLETED" } });
    const unresolved = await tx.marketplaceStoreOrderAdjustment.count({ where: { marketplaceStoreOrderId: order.id, status: { not: "COMPLETED" } } });
    const openIssues = await tx.marketplaceStoreOrderIssue.count({ where: { marketplaceStoreOrderId: order.id, status: { in: ["OPEN", "CUSTOMER_ACTION_REQUIRED", "REFUND_PENDING"] } } });
    const openCases = await tx.marketplaceStoreOrderReconciliationCase.count({ where: { marketplaceStoreOrderId: order.id, status: "OPEN" } });
    if (!unresolved && !openIssues && !openCases) {
      const current = await tx.marketplaceStoreOrder.findUniqueOrThrow({ where: { id: order.id } });
      await tx.marketplaceStoreOrder.update({ where: { id: current.id }, data: { financialResolutionStatus: "REFUND_COMPLETED", resolutionStatus: "RESOLVED", operationalVersion: { increment: 1 }, derivedStatus: deriveStoreOrderStatus({ acceptance: current.acceptanceStatus, preparation: current.preparationStatus, resolution: "RESOLVED", delivery: current.deliveryBridgeStatus }) } });
    }
    const operationId = `refund-completed:${refund.publicReference}`, eventType = "STORE_ORDER_REFUND_COMPLETED";
    const evidence = { adjustmentReference: adjustment.publicReference, refundReference: refund.publicReference };
    await tx.marketplaceStoreOrderHistory.upsert({ where: { marketplaceStoreOrderId_operationId_eventType: { marketplaceStoreOrderId: order.id, operationId, eventType } }, create: { marketplaceStoreOrderId: order.id, operationId, eventType, safeEvidence: evidence }, update: {} });
    await tx.marketplaceStoreOrderEventIntent.upsert({ where: { dedupeKey: `${order.id}:${operationId}:${eventType}` }, create: { publicReference: `soevt_${randomUUID().replaceAll("-", "")}`, marketplaceStoreOrderId: order.id, eventType, payload: evidence, dedupeKey: `${order.id}:${operationId}:${eventType}` }, update: {} });
  }
}
