/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is intentionally deferred to Phase 26.5. */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { accrueCommissionInTransaction } from "@/lib/services/commission-accrual.service";
import { accrueStoreEarningInTransaction } from "@/lib/services/store-earning-accrual.service";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import type { CanonicalMarketplaceSettlement, MarketplaceSettlementRepository, SettlementOperationReceipt } from "@/lib/marketplace-checkout/settlement.service";

const reference = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;
const money = (value: any) => typeof value === "string" ? value : value?.toFixed?.(2) ?? "0.00";

function safeJson(value: unknown): Prisma.InputJsonValue { return value as Prisma.InputJsonValue; }

function frozenCommissionBeneficiaries(value: unknown): readonly Readonly<{ beneficiaryType: "PROMOTER"; ownerId: string; walletId: string; commissionPayableAccountId: string; attributionReference: string; attributionVersion: string }>[] {
  const allocations = (value as { beneficiaryAllocations?: unknown })?.beneficiaryAllocations;
  if (!Array.isArray(allocations)) throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "Frozen commission allocation evidence is incomplete.");
  return Object.freeze(allocations.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && (item as Record<string, unknown>).beneficiaryType === "PROMOTER").map((item) => {
    const ownerId = item.beneficiaryOwnerId; const walletId = item.beneficiaryWalletId; const commissionPayableAccountId = item.commissionPayableAccountId; const attributionReference = item.beneficiaryReference; const attributionVersion = item.beneficiaryVersion;
    if (typeof ownerId !== "string" || typeof walletId !== "string" || typeof commissionPayableAccountId !== "string" || typeof attributionReference !== "string" || typeof attributionVersion !== "string") throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "Frozen promoter commission evidence is incomplete.");
    return Object.freeze({ beneficiaryType: "PROMOTER" as const, ownerId, walletId, commissionPayableAccountId, attributionReference, attributionVersion });
  }));
}

/**
 * The only production settlement adapter. It starts a Serializable transaction,
 * locks the aggregate in a stable order, and composes Phase 14 then Phase 16.
 */
export function createPrismaMarketplaceSettlementRepository(database: any = prisma): MarketplaceSettlementRepository {
  const db = database;
  let transactionDb: any = null;
  const current = () => transactionDb ?? db;

  return Object.freeze({
    transaction: async <T>(work: () => Promise<T>) => database.$transaction(async (tx: any) => {
      const previous = transactionDb; transactionDb = tx;
      try { return await work(); } finally { transactionDb = previous; }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    resolveOperationReceipt: async ({ marketplaceStoreOrderReference, operationId, requestHash }): Promise<SettlementOperationReceipt> => {
      const client = current();
      const storeOrder = await client.marketplaceStoreOrder.findUnique({ where: { publicReference: marketplaceStoreOrderReference }, include: { marketplaceOrder: { select: { checkoutId: true } } } });
      if (!storeOrder) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "The marketplace store order does not exist.");
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "id" = ${storeOrder.marketplaceOrder.checkoutId} FOR UPDATE`);
      const existing = await client.marketplaceCheckoutOperation.findUnique({ where: { checkoutId_operationId: { checkoutId: storeOrder.marketplaceOrder.checkoutId, operationId } } });
      if (existing) {
        if (existing.requestHash !== requestHash) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "The operation ID is bound to changed settlement meaning.");
        const response = existing.response as { commissionAccrualReference?: string; storeEarningReference?: string } | null;
        return Object.freeze({ completed: Boolean(response?.commissionAccrualReference && response?.storeEarningReference), response: response?.commissionAccrualReference && response?.storeEarningReference ? { commissionAccrualReference: response.commissionAccrualReference, storeEarningReference: response.storeEarningReference } : null });
      }
      await client.marketplaceCheckoutOperation.create({ data: { checkoutId: storeOrder.marketplaceOrder.checkoutId, operationId, requestHash, type: "SETTLE" } });
      return Object.freeze({ completed: false, response: null });
    },
    lockCanonicalSettlement: async (publicReference): Promise<CanonicalMarketplaceSettlement | null> => {
      const client = current();
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceStoreOrder" WHERE "publicReference" = ${publicReference} FOR UPDATE`);
      const row = await client.marketplaceStoreOrder.findUnique({ where: { publicReference }, include: { marketplaceOrder: { include: { checkout: true, payment: true } }, store: true, settlementSnapshots: { include: { sourceSettlementEvidence: true }, orderBy: { createdAt: "desc" }, take: 1 }, lines: { include: { financialAllocations: true } } } });
      const snapshot = row?.settlementSnapshots[0]; if (!row || !snapshot) return null;
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceSettlementSnapshot" WHERE "id" = ${snapshot.id} FOR UPDATE`);
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${row.marketplaceOrder.paymentId} FOR UPDATE`);
      const wallet = await client.wallet.findUnique({ where: { ownerType_ownerId_currency: { ownerType: "STORE", ownerId: row.storeId, currency: "ZAR" } }, select: { id: true } });
      if (!wallet) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Canonical store wallet evidence is missing.");
      return Object.freeze({
        checkoutId: row.marketplaceOrder.checkoutId, checkoutReference: row.marketplaceOrder.checkout.publicReference,
        storeOrderId: row.id, storeOrderReference: row.publicReference, storeOrderStatus: row.status, storeId: row.storeId, storePublicReference: row.store.slug,
        marketplaceOrderId: row.marketplaceOrderId, marketplaceOrderReference: row.marketplaceOrder.publicReference, marketplaceOrderGrandTotal: money(row.marketplaceOrder.grandTotal),
        payment: { id: row.marketplaceOrder.payment.id, publicReference: row.marketplaceOrder.payment.publicReference, status: row.marketplaceOrder.payment.status, subjectType: row.marketplaceOrder.payment.subjectType, marketplaceOrderId: row.marketplaceOrder.payment.marketplaceOrderId, amount: money(row.marketplaceOrder.payment.amount), currency: row.marketplaceOrder.payment.currency },
        snapshot: { id: snapshot.id, publicReference: snapshot.publicReference, settlementVersion: snapshot.settlementVersion, authoritativeAt: snapshot.authoritativeAt.toISOString(), status: snapshot.status, sellerBasis: money(snapshot.sellerBasis), commissionAmount: money(snapshot.commissionAmount), storeEarningAmount: money(snapshot.storeEarningAmount), deliveryFeeResidual: money(snapshot.deliveryFeeResidual), currency: snapshot.currency, commissionPlanReference: snapshot.commissionPlanReference, commissionPlanVersion: snapshot.commissionPlanVersion, sourceEvidenceFingerprint: snapshot.sourceEvidenceFingerprint, commissionBeneficiarySnapshots: frozenCommissionBeneficiaries(snapshot.sourceSettlementEvidence.commissionEvidence), commissionAccrualReference: snapshot.commissionAccrualReference, storeEarningReference: snapshot.storeEarningReference },
        storeWalletId: wallet.id,
        lines: Object.freeze(row.lines.map((line: any) => Object.freeze({ allocations: Object.freeze(line.financialAllocations.map((allocation: any) => Object.freeze({ type: allocation.type, amount: money(allocation.amount) }))) }))),
      });
    },
    accrueCommissionAndStoreEarning: async ({ settlement, operationId }) => {
      const tx = current();
      const authoritativeAt = settlement.snapshot.authoritativeAt;
      const commission = await accrueCommissionInTransaction(tx, {
        subjectType: "MARKETPLACE_STORE_ORDER", subjectId: settlement.storeOrderId, subjectPublicReference: settlement.storeOrderReference,
        settlementVersion: settlement.snapshot.settlementVersion, scopeKey: `STORE:${settlement.storeId}`, authoritativeAt,
        basis: { subjectType: "MARKETPLACE_STORE_ORDER", subjectId: settlement.storeOrderId, subjectPublicReference: settlement.storeOrderReference, pricingReference: settlement.snapshot.publicReference, pricingVersion: settlement.snapshot.settlementVersion, subtotal: settlement.snapshot.sellerBasis, tax: "0.00", total: settlement.snapshot.sellerBasis, currency: "ZAR", authoritativeAt },
        planPublicReference: settlement.snapshot.commissionPlanReference ?? undefined, planVersionNumber: Number(settlement.snapshot.commissionPlanVersion), beneficiarySnapshots: settlement.snapshot.commissionBeneficiarySnapshots,
      }, { operationId: `${operationId}:commission` });
      if (commission.totalAmount !== settlement.snapshot.commissionAmount) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Frozen settlement commission does not equal the Phase 14 result.");
      const earning = await accrueStoreEarningInTransaction(tx, {
        subjectType: "MARKETPLACE_ORDER", subjectId: settlement.marketplaceOrderId, subjectPublicReference: settlement.marketplaceOrderReference,
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
            create: { publicReference: reference("mrec"), checkoutId: row.marketplaceOrder.checkoutId, marketplaceOrderId: row.marketplaceOrderId, paymentId: row.marketplaceOrder.paymentId, marketplaceStoreOrderId: row.id, reason: "STORE_SETTLEMENT_FAILED", priority: "HIGH", safeSummary, safeEvidence: safeJson({ settlementSnapshot: snapshot.publicReference, operationId }) },
            update: { observationCount: { increment: 1 }, safeSummary },
          })
        : null;
      const retryDelayMinutes = Math.min(60, 2 ** attemptCount);
      await client.$transaction([...(requiresReconciliation ? [client.marketplaceStoreOrder.update({ where: { id: row.id }, data: { status: "RECONCILIATION_REQUIRED" } }), client.marketplaceSettlementSnapshot.update({ where: { id: snapshot.id }, data: { status: "RECONCILIATION_REQUIRED" } })] : []), client.marketplaceStoreSettlementJob.updateMany({ where: { marketplaceStoreOrderId: row.id, settlementVersion: snapshot.settlementVersion }, data: { status: requiresReconciliation ? "RECONCILIATION_REQUIRED" : "RETRYABLE", attemptCount, nextAttemptAt: new Date(Date.now() + retryDelayMinutes * 60_000), lastSafeError: safeError.slice(0, 160), reconciliationCaseId: caseRow?.id ?? null } })]);
    },
  });
}
