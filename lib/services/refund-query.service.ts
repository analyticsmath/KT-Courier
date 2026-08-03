import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CustomerRefundDetailDto, CustomerRefundListItemDto, FinanceRefundListItemDto } from "@/lib/dto/refund.dto";
import type { RefundMethodCode, RefundReasonCodeValue, RefundStatusCode } from "@/lib/refunds/types";
import type { z } from "zod";
import type { AdminRefundListQuerySchema, RefundListQuerySchema, RefundReconciliationListQuerySchema } from "@/lib/validation/refunds";

type CustomerListQuery = z.infer<typeof RefundListQuerySchema>;
type FinanceListQuery = z.infer<typeof AdminRefundListQuerySchema>;
type ReconciliationListQuery = z.infer<typeof RefundReconciliationListQuerySchema>;

type CustomerRefundRow = Readonly<{
  publicReference: string; amount: Prisma.Decimal; status: RefundStatusCode; method: RefundMethodCode;
  reasonCode: RefundReasonCodeValue; customerNote: string | null; createdAt: Date; completedAt: Date | null;
  payment: Readonly<{ publicReference: string; order: Readonly<{ orderNumber: string }> }>;
  statusHistory: readonly Readonly<{ toStatus: RefundStatusCode; reasonCode: string; createdAt: Date }>[];
}>;

type FinanceRefundRow = CustomerRefundRow & Readonly<{
  id: string; financeNote: string | null; approvedByUserId: string | null; approvedAt: Date | null;
  completedByUserId: string | null; customer: Readonly<{ name: string | null; email: string }>;
  payment: Readonly<{ publicReference: string; amount: Prisma.Decimal; totalRefundedAmount: Prisma.Decimal; totalRefundReservedAmount: Prisma.Decimal; order: Readonly<{ orderNumber: string }> }>;
  reserveLedgerJournal: Readonly<{ reference: string }>;
  releaseLedgerJournal: Readonly<{ reference: string }> | null;
  completionLedgerJournal: Readonly<{ reference: string; type: string }> | null;
  fundingAllocations: readonly Readonly<{ publicReference: string; sourceType: string; amount: Prisma.Decimal; ledgerAccount: Readonly<{ code: string; purpose: string; category: string }>; commissionAllocation: Readonly<{ publicReference: string; amount: Prisma.Decimal }> | null }>[];
  attempts: readonly Readonly<{ publicReference: string; attemptNumber: number; provider: string | null; status: string; providerRefundId: string | null; providerPaymentId: string | null; failureCategory: string | null; failureCode: string | null; safeResultSnapshot: unknown; initiatedByUserId: string; completedByUserId: string | null; createdAt: Date; completedAt: Date | null }>[];
  statusHistory: readonly Readonly<{ fromStatus: RefundStatusCode | null; toStatus: RefundStatusCode; actorType: string; reasonCode: string; safeMetadata: unknown; createdAt: Date }>[];
  reconciliationCases: readonly Readonly<{ publicReference: string; reason: string; status: string; priority: string; safeSummary: string }>[];
}>;

type RefundReconciliationListRow = Readonly<{
  publicReference: string; reason: string; status: string; priority: string; safeSummary: string;
  observationCount: number; openedAt: Date; lastObservedAt: Date; resolvedAt: Date | null; resolutionCode: string | null;
  refund: Readonly<{ publicReference: string; amount: Prisma.Decimal }>;
  attempt: Readonly<{ publicReference: string; status: string }> | null;
}>;

const customerInclude = {
  payment: { select: { publicReference: true, order: { select: { orderNumber: true } } } },
  statusHistory: { select: { toStatus: true, reasonCode: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
} as const;

function customerItem(value: unknown): CustomerRefundListItemDto {
  const row = value as CustomerRefundRow;
  return Object.freeze({ publicReference: row.publicReference, paymentReference: row.payment.publicReference, orderReference: row.payment.order.orderNumber, amount: row.amount.toFixed(2), currency: "ZAR", status: row.status, method: row.method, reasonCode: row.reasonCode, requestedAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null, canCancel: row.status === "REQUESTED" || row.status === "UNDER_REVIEW" });
}

function customerDetail(value: unknown): CustomerRefundDetailDto {
  const row = value as CustomerRefundRow;
  return Object.freeze({ ...customerItem(row), customerNote: row.customerNote, progress: Object.freeze(row.statusHistory.map((history) => Object.freeze({ status: history.toStatus, reasonCode: history.reasonCode, createdAt: history.createdAt.toISOString() }))), productionLock: Object.freeze({ active: true as const, blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const }) });
}

const financeInclude = {
  customer: { select: { name: true, email: true } },
  payment: { select: { publicReference: true, amount: true, totalRefundedAmount: true, totalRefundReservedAmount: true, order: { select: { orderNumber: true } } } },
  reserveLedgerJournal: { select: { reference: true } },
  releaseLedgerJournal: { select: { reference: true } },
  completionLedgerJournal: { select: { reference: true, type: true } },
  fundingAllocations: { select: { publicReference: true, sourceType: true, amount: true, ledgerAccount: { select: { code: true, purpose: true, category: true } }, commissionAllocation: { select: { publicReference: true, amount: true } } }, orderBy: { id: "asc" as const } },
  attempts: { select: { publicReference: true, attemptNumber: true, provider: true, status: true, providerRefundId: true, providerPaymentId: true, failureCategory: true, failureCode: true, safeResultSnapshot: true, initiatedByUserId: true, completedByUserId: true, createdAt: true, completedAt: true }, orderBy: { attemptNumber: "asc" as const } },
  statusHistory: { select: { fromStatus: true, toStatus: true, actorType: true, reasonCode: true, safeMetadata: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
  reconciliationCases: { select: { publicReference: true, reason: true, status: true, priority: true, safeSummary: true }, orderBy: { openedAt: "desc" as const } },
} as const;

function financeItem(value: unknown): FinanceRefundListItemDto {
  const row = value as FinanceRefundRow;
  return Object.freeze({ id: row.id, publicReference: row.publicReference, paymentReference: row.payment.publicReference, orderReference: row.payment.order.orderNumber, customer: Object.freeze({ name: row.customer.name ?? "Customer", email: row.customer.email }), amount: row.amount.toFixed(2), currency: "ZAR", status: row.status, method: row.method, reasonCode: row.reasonCode, requestedAt: row.createdAt.toISOString(), reconciliationRequired: row.status === "RECONCILIATION_REQUIRED" || row.reconciliationCases.some((item) => item.status === "OPEN" || item.status === "MONITORING") });
}

function financeDetail(value: unknown) {
  const row = value as FinanceRefundRow;
  const remaining = row.payment.amount.sub(row.payment.totalRefundedAmount).sub(row.payment.totalRefundReservedAmount);
  return Object.freeze({
    ...financeItem(row),
    remainingRefundableAmount: remaining.isNegative() ? "0.00" : remaining.toFixed(2),
    customerNote: row.customerNote,
    financeNote: row.financeNote,
    fundingAllocations: Object.freeze(row.fundingAllocations.map((item) => Object.freeze({ publicReference: item.publicReference, sourceType: item.sourceType, amount: item.amount.toFixed(2), currency: "ZAR", account: Object.freeze({ code: item.ledgerAccount.code, purpose: item.ledgerAccount.purpose, category: item.ledgerAccount.category }), commissionAllocation: item.commissionAllocation ? Object.freeze({ publicReference: item.commissionAllocation.publicReference, originalAmount: item.commissionAllocation.amount.toFixed(2) }) : null }))),
    journals: Object.freeze({ reserve: row.reserveLedgerJournal.reference, release: row.releaseLedgerJournal?.reference ?? null, completion: row.completionLedgerJournal?.reference ?? null, completionType: row.completionLedgerJournal?.type ?? null }),
    attempts: Object.freeze(row.attempts.map((attempt) => Object.freeze({ publicReference: attempt.publicReference, attemptNumber: attempt.attemptNumber, provider: attempt.provider, status: attempt.status, providerRefundId: attempt.providerRefundId, providerPaymentId: attempt.providerPaymentId, failureCategory: attempt.failureCategory, failureCode: attempt.failureCode, safeResult: attempt.safeResultSnapshot, initiatedByUserId: attempt.initiatedByUserId, completedByUserId: attempt.completedByUserId, createdAt: attempt.createdAt.toISOString(), completedAt: attempt.completedAt?.toISOString() ?? null }))),
    approval: Object.freeze({ approvedByUserId: row.approvedByUserId, approvedAt: row.approvedAt?.toISOString() ?? null, completedByUserId: row.completedByUserId, completedAt: row.completedAt?.toISOString() ?? null }),
    history: Object.freeze(row.statusHistory.map((history: any) => Object.freeze({ fromStatus: history.fromStatus ?? null, toStatus: history.toStatus, actorType: history.actorType ?? null, reasonCode: history.reasonCode, safeMetadata: history.safeMetadata ?? null, createdAt: history.createdAt.toISOString() }))),
    reconciliation: Object.freeze(row.reconciliationCases.map((item) => Object.freeze({ ...item }))),
    productionLock: Object.freeze({ active: true, blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" }),
  });
}

const pagination = (page: number, pageSize: number, total: number) => Object.freeze({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });

export async function listCustomerRefunds(userId: string, query: CustomerListQuery) {
  const where = { customerUserId: userId, ...(query.status && { status: query.status }), ...(query.from || query.to ? { createdAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } } : {}) };
  const [total, rows] = await prisma.$transaction([prisma.paymentRefund.count({ where }), prisma.paymentRefund.findMany({ where, include: customerInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map(customerItem)), pagination: pagination(query.page, query.pageSize, total) });
}

export async function getCustomerRefund(userId: string, publicReference: string): Promise<CustomerRefundDetailDto | null> {
  const row = await prisma.paymentRefund.findFirst({ where: { publicReference, customerUserId: userId }, include: customerInclude });
  return row ? customerDetail(row) : null;
}

export async function listFinanceRefunds(query: FinanceListQuery) {
  const where: any = { ...(query.status && { status: query.status }), ...(query.method && { method: query.method }), ...(query.reasonCode && { reasonCode: query.reasonCode }), ...(query.reconciliation !== undefined && { reconciliationCases: query.reconciliation ? { some: { status: { in: ["OPEN", "MONITORING"] } } } : { none: { status: { in: ["OPEN", "MONITORING"] } } } }), ...(query.reference && { OR: [{ publicReference: { contains: query.reference, mode: "insensitive" as const } }, { payment: { publicReference: { contains: query.reference, mode: "insensitive" as const } } }] }), ...(query.from || query.to ? { createdAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } } : {}) };
  const [total, rows] = await prisma.$transaction([prisma.paymentRefund.count({ where }), prisma.paymentRefund.findMany({ where, include: financeInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map(financeItem)), pagination: pagination(query.page, query.pageSize, total) });
}

export async function getFinanceRefund(id: string) {
  const row = await prisma.paymentRefund.findUnique({ where: { id }, include: financeInclude });
  return row ? financeDetail(row) : null;
}

export async function resolveFinanceRefundReference(id: string): Promise<string | null> {
  const row = await prisma.paymentRefund.findUnique({ where: { id }, select: { publicReference: true } });
  return row?.publicReference ?? null;
}

export async function listRefundReconciliation(query: ReconciliationListQuery) {
  const where = { ...(query.status && { status: query.status }), ...(query.reason && { reason: query.reason }) };
  const [total, rows] = await prisma.$transaction([prisma.refundReconciliationCase.count({ where }), prisma.refundReconciliationCase.findMany({ where, include: { refund: { select: { publicReference: true, amount: true } }, attempt: { select: { publicReference: true, status: true } } }, orderBy: [{ lastObservedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map((value) => { const row = value as RefundReconciliationListRow; return Object.freeze({ publicReference: row.publicReference, refundReference: row.refund.publicReference, attemptReference: row.attempt?.publicReference ?? null, amount: row.refund.amount.toFixed(2), currency: "ZAR", reason: row.reason, status: row.status, priority: row.priority, summary: row.safeSummary, observationCount: row.observationCount, openedAt: row.openedAt.toISOString(), lastObservedAt: row.lastObservedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, resolutionCode: row.resolutionCode }); })), pagination: pagination(query.page, query.pageSize, total) });
}

export async function getRefundReconciliation(publicReference: string) {
  const row = await prisma.refundReconciliationCase.findUnique({ where: { publicReference }, include: { refund: { select: { id: true, publicReference: true, amount: true, status: true } }, attempt: { select: { publicReference: true, status: true, providerRefundId: true, failureCode: true } } } });
  if (!row) return null;
  return Object.freeze({ publicReference: row.publicReference, refund: Object.freeze({ id: row.refund.id, publicReference: row.refund.publicReference, amount: row.refund.amount.toFixed(2), currency: "ZAR", status: row.refund.status }), attempt: row.attempt ? Object.freeze({ publicReference: row.attempt.publicReference, status: row.attempt.status, providerRefundId: row.attempt.providerRefundId, failureCode: row.attempt.failureCode }) : null, reason: row.reason, status: row.status, priority: row.priority, summary: row.safeSummary, safeEvidence: row.safeEvidence, observationCount: row.observationCount, openedAt: row.openedAt.toISOString(), lastObservedAt: row.lastObservedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, resolutionCode: row.resolutionCode });
}
