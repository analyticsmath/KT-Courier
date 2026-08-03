import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { StoreEarningError } from "@/lib/store-earnings/errors";
import { mayResolveStoreEarningReconciliation } from "@/lib/store-earnings/store-earning-reconciliation-policy";

const reference = () => `SERC-${randomUUID().replaceAll("-", "").toUpperCase()}`;

export async function openStoreEarningReconciliationWithinTransaction(tx: Prisma.TransactionClient, input: Readonly<{
  caseKey: string;
  storeEarningId: string;
  refundId?: string;
  commissionAccrualId?: string;
  reason: "SETTLEMENT_BASIS_MISMATCH" | "COMMISSION_ATTRIBUTION_MISMATCH" | "COMMISSION_OVER_ATTRIBUTION" | "DUPLICATE_STORE_SETTLEMENT" | "LEDGER_LINK_MISSING" | "LEDGER_AMOUNT_MISMATCH" | "REFUND_ADJUSTMENT_MISMATCH" | "REFUND_AFTER_RELEASE" | "RELEASE_WITH_OPEN_REFUND" | "RELEASE_BALANCE_MISMATCH" | "REVERSAL_BLOCKED_BY_COMMISSION" | "REVERSAL_AFTER_RELEASE" | "STORE_ACCOUNT_MISMATCH" | "STALE_ACCRUAL" | "APPLICATION_FAILURE";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  safeSummary: string;
  safeEvidence?: Prisma.InputJsonValue;
}>) {
  if (!input.caseKey.trim() || input.caseKey.length > 191 || !input.safeSummary.trim() || input.safeSummary.length > 500) throw new StoreEarningError("STORE_EARNING_INVALID_COMMAND", "Store earning reconciliation evidence is invalid.");
  return tx.storeEarningReconciliationCase.upsert({
    where: { caseKey: input.caseKey },
    update: { status: "OPEN", priority: input.priority ?? "MEDIUM", observationCount: { increment: 1 }, lastObservedAt: new Date(), safeSummary: input.safeSummary, safeEvidence: input.safeEvidence },
    create: { publicReference: reference(), caseKey: input.caseKey, storeEarningId: input.storeEarningId, refundId: input.refundId, commissionAccrualId: input.commissionAccrualId, reason: input.reason, status: "OPEN", priority: input.priority ?? "MEDIUM", safeSummary: input.safeSummary, safeEvidence: input.safeEvidence },
  });
}

export async function resolveStoreEarningReconciliationsWithinTransaction(tx: Prisma.TransactionClient, input: Readonly<{ storeEarningId: string; canonicalOperationReference: string; resolutionCode: string }>) {
  if (!mayResolveStoreEarningReconciliation({ financialInvariantRestored: true, canonicalOperationReference: input.canonicalOperationReference }) || !/^[A-Z][A-Z0-9_]{2,79}$/.test(input.resolutionCode)) throw new StoreEarningError("STORE_EARNING_RECONCILIATION_REQUIRED", "Reconciliation may resolve only through canonical financial evidence.");
  return tx.storeEarningReconciliationCase.updateMany({ where: { storeEarningId: input.storeEarningId, status: { in: ["OPEN", "MONITORING"] } }, data: { status: "RESOLVED", resolvedAt: new Date(), resolutionCode: input.resolutionCode } });
}

export async function createStoreEarningReconciliation(input: Parameters<typeof openStoreEarningReconciliationWithinTransaction>[1]) {
  return prisma.$transaction((tx) => openStoreEarningReconciliationWithinTransaction(tx, input), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
