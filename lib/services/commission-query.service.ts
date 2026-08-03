import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const include = {
  plan: { select: { publicReference: true, versionNumber: true, basisType: true, scopeKey: true } },
  ledgerJournal: { select: { reference: true } },
  reversalLedgerJournal: { select: { reference: true } },
  allocations: { include: { rule: { select: { publicReference: true, ruleCode: true } }, ledgerAccount: { select: { code: true, purpose: true, category: true } } }, orderBy: { createdAt: "asc" as const } },
  statusHistory: { orderBy: { createdAt: "asc" as const }, select: { fromStatus: true, toStatus: true, actorType: true, reasonCode: true, createdAt: true } },
  reconciliationCases: { orderBy: { lastObservedAt: "desc" as const }, select: { publicReference: true, reason: true, status: true, priority: true, safeSummary: true, openedAt: true } },
} satisfies Prisma.CommissionAccrualInclude;

function item(row: Prisma.CommissionAccrualGetPayload<{ include: typeof include }>) {
  return Object.freeze({ id: row.id, publicReference: row.publicReference, subjectType: row.subjectType, subjectPublicReference: row.subjectPublicReference, settlementVersion: row.settlementVersion, planReference: row.plan.publicReference, planVersionNumber: row.plan.versionNumber, basisType: row.basisType, basisAmount: row.basisAmount.toFixed(2), totalAmount: row.totalAmount.toFixed(2), currency: "ZAR" as const, status: row.status, authoritativeAt: row.authoritativeAt.toISOString(), createdAt: row.createdAt.toISOString(), reconciliationRequired: row.status === "RECONCILIATION_REQUIRED" || row.reconciliationCases.some((record) => record.status === "OPEN" || record.status === "MONITORING") });
}

function detail(row: Prisma.CommissionAccrualGetPayload<{ include: typeof include }>) {
  return Object.freeze({ ...item(row), basisSnapshot: row.basisSnapshot, plan: Object.freeze({ publicReference: row.plan.publicReference, versionNumber: row.plan.versionNumber, basisType: row.plan.basisType, scopeKey: row.plan.scopeKey }), ledgerJournalReference: row.ledgerJournal.reference, reversalLedgerJournalReference: row.reversalLedgerJournal?.reference ?? null, reversalReasonCode: row.reversalReasonCode, allocations: Object.freeze(row.allocations.map((allocation) => Object.freeze({ publicReference: allocation.publicReference, ruleReference: allocation.rule.publicReference, ruleCode: allocation.rule.ruleCode, allocationType: allocation.allocationType, beneficiaryType: allocation.beneficiaryType, beneficiaryOwnerId: allocation.beneficiaryOwnerId, amount: allocation.amount.toFixed(2), currency: "ZAR" as const, accountCode: allocation.ledgerAccount.code, accountPurpose: allocation.ledgerAccount.purpose, accountCategory: allocation.ledgerAccount.category, status: allocation.status, attributionReference: allocation.attributionReference }))), history: Object.freeze(row.statusHistory.map((history) => Object.freeze({ fromStatus: history.fromStatus, toStatus: history.toStatus, actorType: history.actorType, reasonCode: history.reasonCode, createdAt: history.createdAt.toISOString() }))), reconciliation: Object.freeze(row.reconciliationCases.map((record) => Object.freeze({ publicReference: record.publicReference, reason: record.reason, status: record.status, priority: record.priority, safeSummary: record.safeSummary, openedAt: record.openedAt.toISOString() }))) });
}

export async function listCommissions(query: Readonly<{ page: number; pageSize: number; status?: "ACCRUED" | "REVERSED" | "RECONCILIATION_REQUIRED"; subjectReference?: string; plan?: string; beneficiaryType?: "PLATFORM" | "PROMOTER"; allocationType?: "PLATFORM_COMMISSION_REVENUE" | "BENEFICIARY_COMMISSION_PAYABLE"; reconciliation?: boolean; from?: string; to?: string; minAmount?: string; maxAmount?: string }>) {
  const where: Prisma.CommissionAccrualWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.subjectReference ? { subjectPublicReference: { contains: query.subjectReference, mode: "insensitive" } } : {}),
    ...(query.plan ? { plan: { publicReference: query.plan } } : {}),
    ...(query.beneficiaryType || query.allocationType ? { allocations: { some: { ...(query.beneficiaryType ? { beneficiaryType: query.beneficiaryType } : {}), ...(query.allocationType ? { allocationType: query.allocationType } : {}) } } } : {}),
    ...(query.reconciliation === true ? { OR: [{ status: "RECONCILIATION_REQUIRED" }, { reconciliationCases: { some: { status: { in: ["OPEN", "MONITORING"] } } } }] } : query.reconciliation === false ? { reconciliationCases: { none: { status: { in: ["OPEN", "MONITORING"] } } } } : {}),
    ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}),
    ...(query.minAmount || query.maxAmount ? { totalAmount: { ...(query.minAmount ? { gte: new Prisma.Decimal(query.minAmount) } : {}), ...(query.maxAmount ? { lte: new Prisma.Decimal(query.maxAmount) } : {}) } } : {}),
  };
  const [total, rows] = await prisma.$transaction([prisma.commissionAccrual.count({ where }), prisma.commissionAccrual.findMany({ where, include, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map(item)), pagination: Object.freeze({ page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) }) });
}

export async function getCommissionAccrual(id: string) {
  const row = await prisma.commissionAccrual.findUnique({ where: { id }, include });
  return row ? detail(row) : null;
}

export async function listCommissionReconciliation(query: Readonly<{ page: number; pageSize: number; status?: "OPEN" | "MONITORING" | "RESOLVED" | "CLOSED"; reason?: string }>) {
  const where: Prisma.CommissionReconciliationCaseWhereInput = { ...(query.status ? { status: query.status } : {}), ...(query.reason ? { reason: query.reason as Prisma.EnumCommissionReconciliationReasonFilter["equals"] } : {}) };
  const [total, rows] = await prisma.$transaction([prisma.commissionReconciliationCase.count({ where }), prisma.commissionReconciliationCase.findMany({ where, include: { accrual: { select: { publicReference: true, totalAmount: true } }, allocation: { select: { publicReference: true } } }, orderBy: [{ lastObservedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map((row) => Object.freeze({ publicReference: row.publicReference, accrualReference: row.accrual.publicReference, allocationReference: row.allocation?.publicReference ?? null, totalAmount: row.accrual.totalAmount.toFixed(2), reason: row.reason, status: row.status, priority: row.priority, safeSummary: row.safeSummary, observationCount: row.observationCount, openedAt: row.openedAt.toISOString(), lastObservedAt: row.lastObservedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, resolutionCode: row.resolutionCode }))), pagination: Object.freeze({ page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) }) });
}

export async function getCommissionReconciliation(publicReference: string) {
  const row = await prisma.commissionReconciliationCase.findUnique({ where: { publicReference }, include: { accrual: { select: { publicReference: true, totalAmount: true, status: true } }, allocation: { select: { publicReference: true, status: true } } } });
  if (!row) return null;
  return Object.freeze({ publicReference: row.publicReference, accrualReference: row.accrual.publicReference, accrualAmount: row.accrual.totalAmount.toFixed(2), accrualStatus: row.accrual.status, allocationReference: row.allocation?.publicReference ?? null, allocationStatus: row.allocation?.status ?? null, reason: row.reason, status: row.status, priority: row.priority, safeSummary: row.safeSummary, safeEvidence: row.safeEvidence, observationCount: row.observationCount, openedAt: row.openedAt.toISOString(), lastObservedAt: row.lastObservedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, resolutionCode: row.resolutionCode });
}
