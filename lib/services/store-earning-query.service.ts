import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { FinanceStoreEarningListItemDto, StoreEarningDetailDto, StoreEarningListItemDto } from "@/lib/dto/store-earning.dto";
import { StoreEarningError } from "@/lib/store-earnings/errors";
import { formatStoreEarningMoney } from "@/lib/store-earnings/store-earning-money";

const include = {
  store: { select: { name: true, slug: true } },
  accrualLedgerJournal: { select: { reference: true } },
  releaseLedgerJournal: { select: { reference: true } },
  reversalLedgerJournal: { select: { reference: true } },
  commissionCharges: { include: { commissionAllocation: { select: { publicReference: true, amount: true, storeAttributedAmount: true, allocationType: true, status: true, accrual: { select: { publicReference: true, status: true } } } } }, orderBy: { createdAt: "asc" as const } },
  fundingAllocations: { include: { refund: { select: { publicReference: true, status: true } } }, orderBy: { createdAt: "asc" as const } },
  statusHistory: { orderBy: { createdAt: "asc" as const }, select: { fromStatus: true, toStatus: true, actorType: true, reasonCode: true, safeMetadata: true, createdAt: true } },
  reconciliationCases: { orderBy: { lastObservedAt: "desc" as const }, select: { publicReference: true, reason: true, status: true, priority: true, safeSummary: true, safeEvidence: true, observationCount: true, openedAt: true, lastObservedAt: true, resolvedAt: true, resolutionCode: true } },
} satisfies Prisma.StoreEarningInclude;

type Row = Prisma.StoreEarningGetPayload<{ include: typeof include }>;
export type StoreEarningListQuery = Readonly<{ page: number; pageSize: number; status?: "ACCRUED" | "RELEASED" | "FULLY_REFUNDED" | "REVERSED" | "RECONCILIATION_REQUIRED"; from?: string; to?: string }>;
export type FinanceStoreEarningListQuery = StoreEarningListQuery & Readonly<{ storeReference?: string; subjectReference?: string; paymentReference?: string; reconciliation?: boolean }>;

function available(row: Row): Prisma.Decimal {
  const value = row.amount.sub(row.refundReservedAmount).sub(row.refundedAmount).sub(row.releasedAmount).sub(row.reversedAmount);
  return value.isNegative() ? new Prisma.Decimal(0) : value;
}

function storeItem(row: Row): StoreEarningListItemDto {
  return Object.freeze({ publicReference: row.publicReference, subjectPublicReference: row.subjectPublicReference, settlementReference: row.settlementReference, originalEarningAmount: formatStoreEarningMoney(row.amount), refundReservedAmount: formatStoreEarningMoney(row.refundReservedAmount), refundedAmount: formatStoreEarningMoney(row.refundedAmount), releasedAmount: formatStoreEarningMoney(row.releasedAmount), availablePayableAmount: formatStoreEarningMoney(available(row)), currency: "ZAR", status: row.status, releaseEligibleAt: row.releaseEligibleAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() });
}

function storeDetail(row: Row): StoreEarningDetailDto {
  return Object.freeze({ ...storeItem(row), releaseJournalReference: row.releaseLedgerJournal?.reference ?? null, history: Object.freeze(row.statusHistory.map((event) => Object.freeze({ status: event.toStatus, reasonCode: event.reasonCode, createdAt: event.createdAt.toISOString() }))), productionLock: Object.freeze({ active: true as const, blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const }) });
}

function financeItem(row: Row): FinanceStoreEarningListItemDto {
  return Object.freeze({ ...storeItem(row), id: row.id, storePublicReference: row.storePublicReference, paymentPublicReference: row.paymentPublicReference, settlementVersion: row.settlementVersion, settlementBasisAmount: formatStoreEarningMoney(row.settlementBasisAmount), attributedCommissionAmount: formatStoreEarningMoney(row.attributedCommissionAmount), reversedAmount: formatStoreEarningMoney(row.reversedAmount), reconciliationRequired: row.status === "RECONCILIATION_REQUIRED" || row.reconciliationCases.some((record) => record.status === "OPEN" || record.status === "MONITORING") });
}

function financeDetail(row: Row) {
  return Object.freeze({
    ...financeItem(row), calculationVersion: row.calculationVersion, authoritativeAt: row.authoritativeAt.toISOString(),
    journals: Object.freeze({ accrual: row.accrualLedgerJournal.reference, release: row.releaseLedgerJournal?.reference ?? null, reversal: row.reversalLedgerJournal?.reference ?? null }),
    commissionCharges: Object.freeze(row.commissionCharges.map((charge) => Object.freeze({ publicReference: charge.publicReference, commissionAllocationReference: charge.commissionAllocation.publicReference, commissionAccrualReference: charge.commissionAllocation.accrual.publicReference, amount: formatStoreEarningMoney(charge.amount), currency: "ZAR" as const, allocationType: charge.commissionAllocation.allocationType, allocationStatus: charge.commissionAllocation.status, commissionAccrualStatus: charge.commissionAllocation.accrual.status, allocationOriginalAmount: formatStoreEarningMoney(charge.commissionAllocation.amount), allocationStoreAttributedAmount: formatStoreEarningMoney(charge.commissionAllocation.storeAttributedAmount) }))),
    refunds: Object.freeze(row.fundingAllocations.map((allocation) => Object.freeze({ fundingReference: allocation.publicReference, refundReference: allocation.refund.publicReference, status: allocation.refund.status, amount: formatStoreEarningMoney(allocation.amount), currency: "ZAR" as const }))),
    history: Object.freeze(row.statusHistory.map((event) => Object.freeze({ fromStatus: event.fromStatus, toStatus: event.toStatus, actorType: event.actorType, reasonCode: event.reasonCode, safeMetadata: event.safeMetadata, createdAt: event.createdAt.toISOString() }))),
    reconciliation: Object.freeze(row.reconciliationCases.map((record) => Object.freeze({ publicReference: record.publicReference, reason: record.reason, status: record.status, priority: record.priority, safeSummary: record.safeSummary, safeEvidence: record.safeEvidence, observationCount: record.observationCount, openedAt: record.openedAt.toISOString(), lastObservedAt: record.lastObservedAt.toISOString(), resolvedAt: record.resolvedAt?.toISOString() ?? null, resolutionCode: record.resolutionCode }))),
    productionLock: Object.freeze({ active: true, blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" }),
  });
}

async function resolveOwnedActiveStore(userId: string) {
  const [user, stores] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } }), prisma.store.findMany({ where: { ownerUserId: userId }, select: { id: true, slug: true, status: true }, orderBy: { createdAt: "asc" }, take: 2 })]);
  if (!user || user.role !== "STORE" || user.status !== "ACTIVE" || stores.length !== 1 || stores[0]!.status !== "ACTIVE") throw new StoreEarningError("STORE_EARNING_FORBIDDEN", "An active uniquely-owned store is required to read earnings.");
  return stores[0]!;
}

function dateWhere(query: StoreEarningListQuery): Prisma.DateTimeFilter | undefined {
  return query.from || query.to ? { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } : undefined;
}

function page(page: number, pageSize: number, total: number) {
  return Object.freeze({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

export async function listStoreEarningsForOwner(userId: string, query: StoreEarningListQuery) {
  const store = await resolveOwnedActiveStore(userId);
  const where: Prisma.StoreEarningWhereInput = { storeId: store.id, ...(query.status ? { status: query.status } : {}), ...(dateWhere(query) ? { createdAt: dateWhere(query) } : {}) };
  const [total, rows] = await prisma.$transaction([prisma.storeEarning.count({ where }), prisma.storeEarning.findMany({ where, include, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map(storeItem)), pagination: page(query.page, query.pageSize, total) });
}

export async function getStoreEarningForOwner(userId: string, publicReference: string) {
  const store = await resolveOwnedActiveStore(userId);
  const row = await prisma.storeEarning.findFirst({ where: { publicReference, storeId: store.id }, include });
  return row ? storeDetail(row) : null;
}

export async function listFinanceStoreEarnings(query: FinanceStoreEarningListQuery) {
  const where: Prisma.StoreEarningWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.storeReference ? { storePublicReference: { contains: query.storeReference, mode: "insensitive" } } : {}),
    ...(query.subjectReference ? { subjectPublicReference: { contains: query.subjectReference, mode: "insensitive" } } : {}),
    ...(query.paymentReference ? { paymentPublicReference: { contains: query.paymentReference, mode: "insensitive" } } : {}),
    ...(query.reconciliation === true ? { reconciliationCases: { some: { status: { in: ["OPEN", "MONITORING"] } } } } : query.reconciliation === false ? { reconciliationCases: { none: { status: { in: ["OPEN", "MONITORING"] } } } } : {}),
    ...(dateWhere(query) ? { createdAt: dateWhere(query) } : {}),
  };
  const [total, rows] = await prisma.$transaction([prisma.storeEarning.count({ where }), prisma.storeEarning.findMany({ where, include, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map(financeItem)), pagination: page(query.page, query.pageSize, total) });
}

export async function getFinanceStoreEarning(id: string) {
  const row = await prisma.storeEarning.findUnique({ where: { id }, include });
  return row ? financeDetail(row) : null;
}

export async function listStoreEarningReconciliation(query: Readonly<{ page: number; pageSize: number; status?: "OPEN" | "MONITORING" | "RESOLVED" | "CLOSED"; reason?: string }>) {
  const where: Prisma.StoreEarningReconciliationCaseWhereInput = { ...(query.status ? { status: query.status } : {}), ...(query.reason ? { reason: query.reason as Prisma.EnumStoreEarningReconciliationReasonFilter["equals"] } : {}) };
  const [total, rows] = await prisma.$transaction([prisma.storeEarningReconciliationCase.count({ where }), prisma.storeEarningReconciliationCase.findMany({ where, include: { storeEarning: { select: { id: true, publicReference: true, storePublicReference: true, amount: true, status: true } }, refund: { select: { publicReference: true } }, commissionAccrual: { select: { publicReference: true } } }, orderBy: [{ lastObservedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map((row) => Object.freeze({ publicReference: row.publicReference, earningId: row.storeEarning.id, earningReference: row.storeEarning.publicReference, storePublicReference: row.storeEarning.storePublicReference, earningAmount: formatStoreEarningMoney(row.storeEarning.amount), earningStatus: row.storeEarning.status, refundReference: row.refund?.publicReference ?? null, commissionAccrualReference: row.commissionAccrual?.publicReference ?? null, reason: row.reason, status: row.status, priority: row.priority, safeSummary: row.safeSummary, observationCount: row.observationCount, openedAt: row.openedAt.toISOString(), lastObservedAt: row.lastObservedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, resolutionCode: row.resolutionCode }))), pagination: page(query.page, query.pageSize, total) });
}

export async function getStoreEarningReconciliation(publicReference: string) {
  const row = await prisma.storeEarningReconciliationCase.findUnique({ where: { publicReference }, include: { storeEarning: { select: { id: true, publicReference: true, storePublicReference: true, amount: true, status: true } }, refund: { select: { publicReference: true, status: true } }, commissionAccrual: { select: { publicReference: true, status: true } } } });
  if (!row) return null;
  return Object.freeze({ publicReference: row.publicReference, earning: Object.freeze({ id: row.storeEarning.id, publicReference: row.storeEarning.publicReference, storePublicReference: row.storeEarning.storePublicReference, amount: formatStoreEarningMoney(row.storeEarning.amount), currency: "ZAR" as const, status: row.storeEarning.status }), refund: row.refund ? Object.freeze({ publicReference: row.refund.publicReference, status: row.refund.status }) : null, commissionAccrual: row.commissionAccrual ? Object.freeze({ publicReference: row.commissionAccrual.publicReference, status: row.commissionAccrual.status }) : null, reason: row.reason, status: row.status, priority: row.priority, safeSummary: row.safeSummary, safeEvidence: row.safeEvidence, observationCount: row.observationCount, openedAt: row.openedAt.toISOString(), lastObservedAt: row.lastObservedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, resolutionCode: row.resolutionCode });
}
