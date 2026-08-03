import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  PaymentReconciliationDetailDto,
  PaymentReconciliationListDto,
  PaymentReconciliationListItemDto,
  PaymentWebhookDetailDto,
  PaymentWebhookListDto,
  PaymentWebhookListItemDto,
} from "@/lib/dto/payment-confirmation.dto";
import type { PaymentReconciliationListQuery, PaymentWebhookListQuery } from "@/lib/validation/payment-confirmation";

const pagination = (page: number, pageSize: number, total: number) => Object.freeze({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });

function safeAmount(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>).amountGross;
  return typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value) ? value : null;
}

function webhookListItem(row: {
  id: string; publicReference: string; provider: string; environment: string; providerStatus: string; normalizedStatus: string;
  processingStatus: string; providerPaymentId: string | null; safePayloadSnapshot: unknown; receivedAt: Date; appliedAt: Date | null;
  payment: { publicReference: string } | null; attempt: { publicReference: string | null } | null; reconciliationCases: readonly { id: string }[];
}): PaymentWebhookListItemDto {
  return Object.freeze({
    publicReference: row.publicReference,
    provider: "PAYFAST",
    environment: row.environment as "SANDBOX" | "PRODUCTION",
    providerStatus: row.providerStatus,
    normalizedStatus: row.normalizedStatus as PaymentWebhookListItemDto["normalizedStatus"],
    processingStatus: row.processingStatus,
    paymentReference: row.payment?.publicReference ?? null,
    attemptReference: row.attempt?.publicReference ?? null,
    providerPaymentId: row.providerPaymentId,
    amount: safeAmount(row.safePayloadSnapshot),
    reconciliationRequired: row.processingStatus === "RECONCILIATION_REQUIRED" || row.reconciliationCases.length > 0,
    receivedAt: row.receivedAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
  });
}

const webhookInclude = {
  payment: { select: { publicReference: true } },
  attempt: { select: { publicReference: true } },
  reconciliationCases: { select: { id: true, publicReference: true, reason: true, status: true }, orderBy: { openedAt: "asc" as const } },
  ledgerJournal: { select: { id: true, reference: true } },
} as const;

export async function listPaymentWebhooks(query: PaymentWebhookListQuery): Promise<PaymentWebhookListDto> {
  const where: Prisma.PaymentWebhookEventWhereInput = {
    provider: "PAYFAST",
    ...(query.environment && { environment: query.environment }),
    ...(query.processingStatus && { processingStatus: query.processingStatus }),
    ...(query.normalizedStatus && { normalizedStatus: query.normalizedStatus }),
    ...(query.paymentReference && { payment: { publicReference: { contains: query.paymentReference, mode: "insensitive" } } }),
    ...(query.attemptReference && { attempt: { publicReference: { contains: query.attemptReference, mode: "insensitive" } } }),
    ...(query.reconciliationRequired !== undefined && (query.reconciliationRequired
      ? { OR: [{ processingStatus: "RECONCILIATION_REQUIRED" }, { reconciliationCases: { some: {} } }] }
      : { AND: [{ processingStatus: { not: "RECONCILIATION_REQUIRED" } }, { reconciliationCases: { none: {} } }] })),
    ...(query.from || query.to ? { receivedAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.paymentWebhookEvent.count({ where }),
    prisma.paymentWebhookEvent.findMany({ where, include: webhookInclude, orderBy: [{ receivedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
  ]);
  return Object.freeze({ data: Object.freeze(rows.map(webhookListItem)), pagination: pagination(query.page, query.pageSize, total) });
}

export async function getPaymentWebhookDetail(publicReference: string): Promise<PaymentWebhookDetailDto | null> {
  const row = await prisma.paymentWebhookEvent.findUnique({ where: { publicReference }, include: webhookInclude });
  if (!row) return null;
  return Object.freeze({
    ...webhookListItem(row),
    verification: Object.freeze({ ["sourceAddress"]: row.sourceAddressVerified, signature: row.signatureVerified, merchant: row.merchantVerified, amount: row.amountVerified, providerConfirmation: row.providerDataVerified }),
    rejectionCode: row.rejectionCode,
    ledgerJournal: row.ledgerJournal ? Object.freeze(row.ledgerJournal) : null,
    reconciliationCases: Object.freeze(row.reconciliationCases.map((entry) => Object.freeze({ publicReference: entry.publicReference, reason: entry.reason, status: entry.status }))),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
  });
}

function reconciliationListItem(row: {
  id: string; publicReference: string; reason: string; status: string; priority: string; summary: string; observationCount: number;
  openedAt: Date; lastObservedAt: Date; resolvedAt: Date | null; payment: { publicReference: string };
  attempt: { publicReference: string | null } | null; webhookEvent: { publicReference: string } | null;
}): PaymentReconciliationListItemDto {
  return Object.freeze({
    publicReference: row.publicReference, reason: row.reason, status: row.status, priority: row.priority,
    summary: row.summary, paymentReference: row.payment.publicReference, attemptReference: row.attempt?.publicReference ?? null,
    eventReference: row.webhookEvent?.publicReference ?? null, observationCount: row.observationCount,
    openedAt: row.openedAt.toISOString(), lastObservedAt: row.lastObservedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null,
  });
}

const reconciliationInclude = {
  payment: { select: { publicReference: true } },
  attempt: { select: { publicReference: true } },
  webhookEvent: { select: { publicReference: true } },
} as const;

export async function listPaymentReconciliation(query: PaymentReconciliationListQuery): Promise<PaymentReconciliationListDto> {
  const where: Prisma.PaymentReconciliationCaseWhereInput = {
    provider: "PAYFAST",
    ...(query.status && { status: query.status }), ...(query.priority && { priority: query.priority }), ...(query.reason && { reason: query.reason }),
    ...(query.paymentReference && { payment: { publicReference: { contains: query.paymentReference, mode: "insensitive" } } }),
    ...(query.attemptReference && { attempt: { publicReference: { contains: query.attemptReference, mode: "insensitive" } } }),
    ...(query.eventReference && { webhookEvent: { publicReference: { contains: query.eventReference, mode: "insensitive" } } }),
    ...(query.from || query.to ? { openedAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.paymentReconciliationCase.count({ where }),
    prisma.paymentReconciliationCase.findMany({ where, include: reconciliationInclude, orderBy: [{ lastObservedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
  ]);
  return Object.freeze({ data: Object.freeze(rows.map(reconciliationListItem)), pagination: pagination(query.page, query.pageSize, total) });
}

export async function getPaymentReconciliationDetail(publicReference: string): Promise<PaymentReconciliationDetailDto | null> {
  const row = await prisma.paymentReconciliationCase.findUnique({ where: { publicReference }, include: reconciliationInclude });
  if (!row) return null;
  const evidence = row.safeEvidence && typeof row.safeEvidence === "object" && !Array.isArray(row.safeEvidence)
    ? row.safeEvidence as Record<string, string | number | boolean | null>
    : null;
  return Object.freeze({ ...reconciliationListItem(row), resolutionCode: row.resolutionCode, safeEvidence: evidence ? Object.freeze({ ...evidence }) : null });
}
