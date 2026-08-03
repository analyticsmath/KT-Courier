/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 17 Prisma Client generation and model type proof are intentionally deferred. */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { DriverEarningError } from "@/lib/driver-earnings/errors";
import { mayResolveDriverEarningReconciliation } from "@/lib/driver-earnings/driver-earning-reconciliation-policy";

const db = prisma as any;
const reference = () => `DERC-${randomUUID().replaceAll("-", "").toUpperCase()}`;
export type DriverReconciliationReason = "ASSIGNMENT_DRIVER_MISMATCH" | "ASSIGNMENT_VERSION_MISMATCH" | "DELIVERY_EVIDENCE_MISSING" | "DELIVERY_EVIDENCE_CONFLICT" | "SETTLEMENT_BASIS_MISMATCH" | "COMMISSION_ATTRIBUTION_MISMATCH" | "COMMISSION_OVER_ATTRIBUTION" | "DUPLICATE_DRIVER_SETTLEMENT" | "LEDGER_LINK_MISSING" | "LEDGER_AMOUNT_MISMATCH" | "REFUND_ADJUSTMENT_MISMATCH" | "REFUND_AFTER_RELEASE" | "RELEASE_WITH_OPEN_REFUND" | "RELEASE_WITH_OPEN_INCIDENT" | "RELEASE_BALANCE_MISMATCH" | "REVERSAL_BLOCKED_BY_COMMISSION" | "REVERSAL_AFTER_RELEASE" | "DRIVER_ACCOUNT_MISMATCH" | "STALE_ACCRUAL" | "APPLICATION_FAILURE";

export async function openDriverEarningReconciliationWithinTransaction(tx: any, input: Readonly<{ caseKey: string; driverEarningId: string; refundId?: string; commissionAccrualId?: string; reason: DriverReconciliationReason; priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; safeSummary: string; safeEvidence?: Prisma.InputJsonValue }>) {
  if (!input.caseKey.trim() || input.caseKey.length > 191 || !input.safeSummary.trim() || input.safeSummary.length > 500) throw new DriverEarningError("DRIVER_EARNING_INVALID_COMMAND", "Driver earning reconciliation evidence is invalid.");
  const record = await tx.driverEarningReconciliationCase.upsert({ where: { caseKey: input.caseKey }, update: { status: "OPEN", priority: input.priority ?? "MEDIUM", observationCount: { increment: 1 }, lastObservedAt: new Date(), safeSummary: input.safeSummary, safeEvidence: input.safeEvidence }, create: { publicReference: reference(), caseKey: input.caseKey, driverEarningId: input.driverEarningId, refundId: input.refundId, commissionAccrualId: input.commissionAccrualId, reason: input.reason, status: "OPEN", priority: input.priority ?? "MEDIUM", safeSummary: input.safeSummary, safeEvidence: input.safeEvidence } });
  const earning = await tx.driverEarning.findUnique({ where: { id: input.driverEarningId }, select: { status: true } });
  if (earning?.status === "ACCRUED") await tx.driverEarning.update({ where: { id: input.driverEarningId }, data: { status: "RECONCILIATION_REQUIRED", version: { increment: 1 }, statusHistory: { create: { fromStatus: "ACCRUED", toStatus: "RECONCILIATION_REQUIRED", actorType: "SYSTEM", reasonCode: input.reason, safeMetadata: { caseReference: record.publicReference } } } } });
  return record;
}

export async function resolveDriverEarningReconciliationsWithinTransaction(tx: any, input: Readonly<{ driverEarningId: string; canonicalOperationReference: string; resolutionCode: string }>) {
  if (!mayResolveDriverEarningReconciliation({ financialInvariantRestored: true, canonicalOperationReference: input.canonicalOperationReference }) || !/^[A-Z][A-Z0-9_]{2,79}$/.test(input.resolutionCode)) throw new DriverEarningError("DRIVER_EARNING_RECONCILIATION_REQUIRED", "Reconciliation may resolve only through canonical financial evidence.");
  const updated = await tx.driverEarningReconciliationCase.updateMany({ where: { driverEarningId: input.driverEarningId, status: { in: ["OPEN", "MONITORING"] } }, data: { status: "RESOLVED", resolvedAt: new Date(), resolutionCode: input.resolutionCode } });
  const open = await tx.driverEarningReconciliationCase.count({ where: { driverEarningId: input.driverEarningId, status: { in: ["OPEN", "MONITORING"] } } });
  if (!open) { const earning = await tx.driverEarning.findUnique({ where: { id: input.driverEarningId }, select: { status: true } }); if (earning?.status === "RECONCILIATION_REQUIRED") await tx.driverEarning.update({ where: { id: input.driverEarningId }, data: { status: "ACCRUED", version: { increment: 1 }, statusHistory: { create: { fromStatus: "RECONCILIATION_REQUIRED", toStatus: "ACCRUED", actorType: "SYSTEM", reasonCode: "RECONCILIATION_RESOLVED", safeMetadata: { canonicalOperationReference: input.canonicalOperationReference } } } } }); }
  return updated;
}

export async function createDriverEarningReconciliation(input: Parameters<typeof openDriverEarningReconciliationWithinTransaction>[1]) { return db.$transaction((tx: any) => openDriverEarningReconciliationWithinTransaction(tx, input), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
