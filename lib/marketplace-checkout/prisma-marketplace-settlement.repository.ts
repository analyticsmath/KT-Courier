import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createMarketplaceSettlementRepository } from "./settlement.repository";
import { postLedgerTransaction } from "@/lib/payments/ledger.service";
import { createCommissionAccrual } from "@/lib/payments/commission.service";
import { createStoreEarningFromCanonicalSale } from "@/lib/finance/store-earning.service";
import { MarketplaceCheckoutError } from "./errors";
import { randomUUID } from "node:crypto";

const reference = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;
const safeJson = (value: unknown) => value as Prisma.InputJsonValue;

type Database = typeof prisma;
type Transaction = Prisma.TransactionClient;

/** PostgreSQL-backed settlement repository. The operation row, immutable
 * settlement snapshot and ledger/commission/earning writes remain the
 * canonical source of truth; callers only receive opaque public references. */
export function createPrismaMarketplaceSettlementRepository(database: Database = prisma) {
  let tx: Transaction | null = null;
  const current = () => tx ?? database;
  return createMarketplaceSettlementRepository({
    begin: async (work) => database.$transaction(async (client) => {
      const previous = tx; tx = client;
      try { return await work(); } finally { tx = previous; }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    findSettlementByStoreOrderReference: async (marketplaceStoreOrderReference) => {
      const row = await current().marketplaceStoreOrder.findUnique({
        where: { publicReference: marketplaceStoreOrderReference },
        include: {
          marketplaceOrder: { include: { checkout: true, payment: true } },
          store: { select: { id: true, publicReference: true, walletId: true } },
          settlementSnapshots: { orderBy: { settlementVersion: "desc" }, take: 1 },
        },
      });
      if (!row) return null;
      const snapshot = row.settlementSnapshots[0];
      if (!snapshot) return null;
      return Object.freeze({
        checkoutId: row.marketplaceOrder.checkoutId,
        marketplaceOrderId: row.marketplaceOrderId,
        marketplaceOrderReference: row.marketplaceOrder.publicReference,
        storeOrderId: row.id,
        storeOrderReference: row.publicReference,
        storeId: row.store.id,
        storePublicReference: row.store.publicReference,
        storeWalletId: row.store.walletId,
        orderStatus: row.status,
        groupTotal: row.groupTotal.toFixed(2),
        payment: Object.freeze({ id: row.marketplaceOrder.payment.id, publicReference: row.marketplaceOrder.payment.publicReference, status: row.marketplaceOrder.payment.status, amount: row.marketplaceOrder.payment.amount.toFixed(2), currency: row.marketplaceOrder.payment.currency }),
        snapshot: Object.freeze({ id: snapshot.id, publicReference: snapshot.publicReference, status: snapshot.status, settlementVersion: snapshot.settlementVersion, authoritativeTotal: snapshot.authoritativeTotal.toFixed(2), sellerBasis: snapshot.sellerBasis.toFixed(2), commissionAmount: snapshot.commissionAmount.toFixed(2), storeEarningAmount: snapshot.storeEarningAmount.toFixed(2), deliveryFeeResidual: snapshot.deliveryFeeResidual.toFixed(2), commissionPlanId: snapshot.commissionPlanId, commissionPlanVersion: snapshot.commissionPlanVersion, commissionPercent: snapshot.commissionPercent?.toFixed(6) ?? null, commissionFixedAmount: snapshot.commissionFixedAmount?.toFixed(2) ?? null }),
      });
    },
    claimSettlementOperation: async ({ settlement, operationId, requestHash }) => {
      const client = current();
      const existing = await client.marketplaceCheckoutOperation.findUnique({ where: { checkoutId_operationId: { checkoutId: settlement.checkoutId, operationId } } });
      if (existing) {
        if (existing.requestHash !== requestHash || existing.operationType !== "STORE_SETTLEMENT") throw new MarketplaceCheckoutError("IDEMPOTENCY_CONFLICT", "Settlement operation does not match the original request.");
        return Object.freeze({ replayed: Boolean(existing.response) });
      }
      await client.marketplaceCheckoutOperation.create({ data: { checkoutId: settlement.checkoutId, operationId, operationType: "STORE_SETTLEMENT", requestHash, response: Prisma.JsonNull } });
      return Object.freeze({ replayed: false });
    },
    assertCanonicalPaidSource: async (settlement) => {
      if (settlement.payment.status !== "SUCCEEDED" || settlement.payment.currency !== "ZAR" || new Prisma.Decimal(settlement.payment.amount).lt(settlement.snapshot.authoritativeTotal)) throw new MarketplaceCheckoutError("PAYMENT_NOT_CONFIRMED", "Canonical marketplace payment is not fully confirmed for settlement.");
      if (settlement.orderStatus !== "DELIVERED" && settlement.orderStatus !== "SETTLED") throw new MarketplaceCheckoutError("ORDER_NOT_DELIVERED", "Store order must be delivered before settlement.");
    },
    postSettlementMoney: async ({ settlement, operationId }) => {
      const client = current();
      const platform = await client.ledgerAccount.findFirst({ where: { purpose: "PLATFORM_REVENUE", currency: "ZAR", status: "ACTIVE" }, select: { id: true } });
      const store = await client.ledgerAccount.findFirst({ where: { walletId: settlement.storeWalletId, purpose: "AVAILABLE", currency: "ZAR", status: "ACTIVE" }, select: { id: true } });
      if (!platform || !store) throw new MarketplaceCheckoutError("SETTLEMENT_ACCOUNTS_MISSING", "Canonical settlement accounts are not configured.");
      const journal = await postLedgerTransaction({ transactionType: "MARKETPLACE_SETTLEMENT", currency: "ZAR", entries: [{ accountId: platform.id, direction: "CREDIT", amount: settlement.snapshot.commissionAmount }, { accountId: store.id, direction: "CREDIT", amount: settlement.snapshot.storeEarningAmount }], metadata: { marketplaceStoreOrderId: settlement.storeOrderId, settlementSnapshotId: settlement.snapshot.id, operationId } }, client);
      return Object.freeze({ journalReference: journal.publicReference });
    },
    createCommissionAndEarning: async ({ settlement, operationId, authoritativeAt }) => {
      const client = current();
      const commission = await createCommissionAccrual({ subjectType: "MARKETPLACE_STORE_ORDER", subjectId: settlement.storeOrderId, subjectPublicReference: settlement.storeOrderReference, storeId: settlement.storeId, grossAmount: settlement.snapshot.sellerBasis, currency: "ZAR", commissionPlanId: settlement.snapshot.commissionPlanId, commissionPlanVersion: settlement.snapshot.commissionPlanVersion, commissionPercent: settlement.snapshot.commissionPercent, commissionFixedAmount: settlement.snapshot.commissionFixedAmount, authoritativeAt }, client);
      const earning = await createStoreEarningFromCanonicalSale({
        storeId: settlement.storeId, storePublicReference: settlement.storePublicReference, walletId: settlement.storeWalletId,
        paymentId: settlement.payment.id, paymentPublicReference: settlement.payment.publicReference, settlementReference: settlement.snapshot.publicReference, settlementVersion: settlement.snapshot.settlementVersion,
        calculationVersion: "phase20-frozen-v1", authoritativeAt, sellerSettlementBasisAmount: settlement.snapshot.sellerBasis, attributedCommissionAmount: settlement.snapshot.commissionAmount,
        netStoreEarningAmount: settlement.snapshot.storeEarningAmount, currency: "ZAR",
        commissionCharges: commission.allocationEvidence.map((allocation) => ({ commissionAllocationId: allocation.id, commissionAllocationPublicReference: allocation.publicReference, amount: allocation.amount, currency: "ZAR" as const })),
      }, commission.allocationEvidence, { operationId: `${operationId}:earning`, commissionSubjectId: settlement.storeOrderId });
      return Object.freeze({ commissionAccrualReference: commission.publicReference, storeEarningReference: earning.publicReference });
    },
    completeSettlement: async ({ settlement, operationId, commissionAccrualReference, storeEarningReference }) => {
      const client = current(); const now = new Date();
      await client.marketplaceSettlementSnapshot.update({ where: { id: settlement.snapshot.id }, data: { status: "COMPLETED", commissionAccrualReference, storeEarningReference, settledAt: now, allocations: { create: [{ type: "COMMISSION", amount: settlement.snapshot.commissionAmount, externalReference: commissionAccrualReference }, { type: "STORE_EARNING", amount: settlement.snapshot.storeEarningAmount, externalReference: storeEarningReference }, { type: "DELIVERY_FEE_RESIDUAL", amount: settlement.snapshot.deliveryFeeResidual, externalReference: null }] }, history: { create: { operationId, fromStatus: settlement.snapshot.status as never, toStatus: "COMPLETED", safeEvidence: safeJson({ commissionAccrualReference, storeEarningReference, deliveryFeeResidual: settlement.snapshot.deliveryFeeResidual }) } } } });
      await client.marketplaceStoreOrder.update({ where: { id: settlement.storeOrderId }, data: { status: "SETTLED" } });
      await client.marketplaceStoreSettlementJob.updateMany({ where: { marketplaceStoreOrderId: settlement.storeOrderId, settlementVersion: settlement.snapshot.settlementVersion }, data: { status: "COMPLETED", completedAt: now, lastSafeError: null } });
      await client.marketplaceCheckoutOperation.update({ where: { checkoutId_operationId: { checkoutId: settlement.checkoutId, operationId } }, data: { response: safeJson({ commissionAccrualReference, storeEarningReference }) } });
    },
    recordReconciliationRequired: async ({ marketplaceStoreOrderReference, operationId, safeError }) => {
      const client = database;
      const row = await client.marketplaceStoreOrder.findUnique({ where: { publicReference: marketplaceStoreOrderReference }, include: { marketplaceOrder: true, settlementSnapshots: { orderBy: { createdAt: "desc" }, take: 1 } } });
      const snapshot = row?.settlementSnapshots[0]; if (!row || !snapshot) return;
      const job = await client.marketplaceStoreSettlementJob.findUnique({ where: { marketplaceStoreOrderId_settlementVersion: { marketplaceStoreOrderId: row.id, settlementVersion: snapshot.settlementVersion } }, select: { id: true, attemptCount: true } });
      const attemptCount = (job?.attemptCount ?? 0) + 1;
      const requiresReconciliation = safeError === "MarketplaceCheckoutError" || attemptCount >= 3;
      const safeSummary = requiresReconciliation ? `Canonical settlement requires reconciliation (${safeError.slice(0, 80)}).` : `Canonical settlement will retry (${safeError.slice(0, 80)}).`;
      const caseRow = requiresReconciliation
        ? await client.marketplaceCheckoutReconciliationCase.upsert({
            where: { checkoutId_reason_operationId: { checkoutId: row.marketplaceOrder.checkoutId, reason: "STORE_SETTLEMENT_FAILED", operationId } },
            create: { publicReference: reference("mrec"), checkoutId: row.marketplaceOrder.checkoutId, marketplaceOrderId: row.marketplaceOrderId, paymentId: row.marketplaceOrder.paymentId, marketplaceStoreOrderId: row.id, reason: "STORE_SETTLEMENT_FAILED", operationId, priority: "HIGH", safeSummary, safeEvidence: safeJson({ settlementSnapshot: snapshot.publicReference, operationId }) },
            update: { observationCount: { increment: 1 }, safeSummary },
          })
        : null;
      const retryDelayMinutes = Math.min(60, 2 ** attemptCount);
      await client.$transaction([...(requiresReconciliation ? [client.marketplaceStoreOrder.update({ where: { id: row.id }, data: { status: "RECONCILIATION_REQUIRED" } }), client.marketplaceSettlementSnapshot.update({ where: { id: snapshot.id }, data: { status: "RECONCILIATION_REQUIRED" } })] : []), client.marketplaceStoreSettlementJob.updateMany({ where: { marketplaceStoreOrderId: row.id, settlementVersion: snapshot.settlementVersion }, data: { status: requiresReconciliation ? "RECONCILIATION_REQUIRED" : "RETRYABLE", attemptCount, nextAttemptAt: new Date(Date.now() + retryDelayMinutes * 60_000), lastSafeError: safeError.slice(0, 160), reconciliationCaseId: caseRow?.id ?? null } })]);
    },
  });
}
