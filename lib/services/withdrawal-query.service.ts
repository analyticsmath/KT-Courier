import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { FinanceWithdrawalDetailDto, FinanceWithdrawalListItemDto, OwnerWithdrawalDetailDto, OwnerWithdrawalListItemDto } from "@/lib/dto/withdrawal.dto";
import type { AdminWithdrawalListQuerySchema, WithdrawalListQuerySchema, WithdrawalReconciliationListQuerySchema } from "@/lib/validation/withdrawals";
import type { z } from "zod";

type OwnerListQuery = z.infer<typeof WithdrawalListQuerySchema>;
type AdminListQuery = z.infer<typeof AdminWithdrawalListQuerySchema>;
type ReconciliationQuery = z.infer<typeof WithdrawalReconciliationListQuerySchema>;

const ownerInclude = {
  payoutDestination: { select: { publicReference: true, maskedLabel: true, institutionName: true, accountLast4: true } },
  payoutAttempts: { select: { publicReference: true, status: true }, orderBy: { attemptNumber: "desc" as const }, take: 1 },
  statusHistory: { select: { fromStatus: true, toStatus: true, reasonCode: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.WithdrawalRequestInclude;

function ownerItem(row: Prisma.WithdrawalRequestGetPayload<{ include: typeof ownerInclude }>): OwnerWithdrawalListItemDto {
  return Object.freeze({ publicReference: row.publicReference, amount: row.amount.toFixed(2), currency: "ZAR", status: row.status, destination: Object.freeze({ publicReference: row.payoutDestination.publicReference, maskedLabel: row.payoutDestination.maskedLabel, institutionName: row.payoutDestination.institutionName, accountLast4: row.payoutDestination.accountLast4 }), requestedAt: row.createdAt.toISOString(), canCancel: row.status === "REQUESTED" || row.status === "UNDER_REVIEW" });
}

function ownerDetail(row: Prisma.WithdrawalRequestGetPayload<{ include: typeof ownerInclude }>): OwnerWithdrawalDetailDto {
  return Object.freeze({ ...ownerItem(row), payoutAttempt: row.payoutAttempts[0] ? Object.freeze({ publicReference: row.payoutAttempts[0].publicReference, status: row.payoutAttempts[0].status }) : null, history: Object.freeze(row.statusHistory.map((history) => Object.freeze({ fromStatus: history.fromStatus, toStatus: history.toStatus, reasonCode: history.reasonCode, createdAt: history.createdAt.toISOString() }))) });
}

const financeInclude = {
  payoutDestination: { select: { publicReference: true, maskedLabel: true, status: true } },
  reserveLedgerJournal: { select: { reference: true } },
  releaseLedgerJournal: { select: { reference: true } },
  payoutLedgerJournal: { select: { reference: true } },
  payoutAttempts: { select: { publicReference: true, attemptNumber: true, status: true, externalReference: true, failureCode: true, createdAt: true }, orderBy: { attemptNumber: "asc" as const } },
  statusHistory: { select: { fromStatus: true, toStatus: true, actorType: true, reasonCode: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
  reconciliationCases: { select: { publicReference: true, reason: true, status: true, priority: true }, orderBy: { openedAt: "desc" as const } },
} satisfies Prisma.WithdrawalRequestInclude;

function financeItem(row: Prisma.WithdrawalRequestGetPayload<{ include: typeof financeInclude }>): FinanceWithdrawalListItemDto {
  return Object.freeze({ id: row.id, publicReference: row.publicReference, ownerType: row.ownerType, amount: row.amount.toFixed(2), currency: "ZAR", status: row.status, destination: Object.freeze({ publicReference: row.payoutDestination.publicReference, maskedLabel: row.payoutDestination.maskedLabel, status: row.payoutDestination.status }), requestedAt: row.createdAt.toISOString(), reconciliationRequired: row.status === "RECONCILIATION_REQUIRED" || row.reconciliationCases.some((caseRow) => caseRow.status === "OPEN" || caseRow.status === "MONITORING") });
}

function financeDetail(row: Prisma.WithdrawalRequestGetPayload<{ include: typeof financeInclude }>): FinanceWithdrawalDetailDto {
  return Object.freeze({ ...financeItem(row), journals: Object.freeze({ reserve: row.reserveLedgerJournal.reference, release: row.releaseLedgerJournal?.reference ?? null, payout: row.payoutLedgerJournal?.reference ?? null }), payoutAttempts: Object.freeze(row.payoutAttempts.map((attempt) => Object.freeze({ publicReference: attempt.publicReference, attemptNumber: attempt.attemptNumber, status: attempt.status, externalReference: attempt.externalReference, failureCode: attempt.failureCode, createdAt: attempt.createdAt.toISOString() }))), approval: Object.freeze({ approvedAt: row.approvedAt?.toISOString() ?? null, approvedByUserId: row.approvedByUserId, completedAt: row.completedAt?.toISOString() ?? null, completedByUserId: row.completedByUserId }), history: Object.freeze(row.statusHistory.map((history) => Object.freeze({ fromStatus: history.fromStatus, toStatus: history.toStatus, actorType: history.actorType, reasonCode: history.reasonCode, createdAt: history.createdAt.toISOString() }))), reconciliation: Object.freeze(row.reconciliationCases.map((caseRow) => Object.freeze({ publicReference: caseRow.publicReference, reason: caseRow.reason, status: caseRow.status, priority: caseRow.priority }))) });
}

const page = (current: number, pageSize: number, total: number) => Object.freeze({ page: current, pageSize, total, totalPages: Math.ceil(total / pageSize) });

export async function listOwnerWithdrawals(userId: string, query: OwnerListQuery) {
  const where: Prisma.WithdrawalRequestWhereInput = { requestedByUserId: userId, ...(query.status && { status: query.status }), ...(query.from || query.to ? { createdAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } } : {}) };
  const [total, rows] = await prisma.$transaction([prisma.withdrawalRequest.count({ where }), prisma.withdrawalRequest.findMany({ where, include: ownerInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map(ownerItem)), pagination: page(query.page, query.pageSize, total) });
}

export async function getOwnerWithdrawal(userId: string, publicReference: string): Promise<OwnerWithdrawalDetailDto | null> {
  const row = await prisma.withdrawalRequest.findFirst({ where: { publicReference, requestedByUserId: userId }, include: ownerInclude });
  return row ? ownerDetail(row) : null;
}

export async function listOwnerPayoutDestinations(userId: string) {
  const ownerWallets = await prisma.wallet.findMany({ where: { ownerType: { in: ["STORE", "DRIVER", "PROMOTER"] }, status: "ACTIVE" }, select: { id: true, ownerType: true, ownerId: true } });
  const eligibleWallets = [] as string[];
  for (const wallet of ownerWallets) {
    if (wallet.ownerType === "STORE" && await prisma.store.findFirst({ where: { id: wallet.ownerId, ownerUserId: userId, status: "ACTIVE" }, select: { id: true } })) eligibleWallets.push(wallet.id);
    if (wallet.ownerType === "DRIVER" && await prisma.driverProfile.findFirst({ where: { id: wallet.ownerId, userId, active: true, status: "ACTIVE" }, select: { id: true } })) eligibleWallets.push(wallet.id);
    if (wallet.ownerType === "PROMOTER" && await prisma.promoterProfile.findFirst({ where: { id: wallet.ownerId, userId, status: "ACTIVE" }, select: { id: true } })) eligibleWallets.push(wallet.id);
  }
  const rows = await prisma.payoutDestination.findMany({ where: { walletId: { in: eligibleWallets }, status: "ACTIVE" }, select: { publicReference: true, maskedLabel: true, institutionName: true, accountLast4: true, currency: true, status: true }, orderBy: { createdAt: "desc" } });
  return Object.freeze(rows.map((row) => Object.freeze({ ...row, currency: "ZAR" as const })));
}

export async function getOwnerWithdrawalOverview(userId: string) {
  const destinations = await listOwnerPayoutDestinations(userId);
  const wallets = await prisma.wallet.findMany({ where: { accounts: { some: { purpose: { in: ["OWNER_WITHDRAWABLE", "WITHDRAWAL_HELD"] }, currency: "ZAR" } } }, select: { id: true, ownerType: true, ownerId: true, accounts: { where: { purpose: { in: ["OWNER_WITHDRAWABLE", "WITHDRAWAL_HELD"] }, currency: "ZAR" }, select: { purpose: true, currentBalance: true } } } });
  let withdrawable = new Prisma.Decimal(0); let held = new Prisma.Decimal(0);
  for (const wallet of wallets) {
    const owner = wallet.ownerType === "STORE"
      ? await prisma.store.findFirst({ where: { id: wallet.ownerId, ownerUserId: userId, status: "ACTIVE" }, select: { id: true } })
      : wallet.ownerType === "DRIVER"
        ? await prisma.driverProfile.findFirst({ where: { id: wallet.ownerId, userId, active: true, status: "ACTIVE" }, select: { id: true } })
        : wallet.ownerType === "PROMOTER"
          ? await prisma.promoterProfile.findFirst({ where: { id: wallet.ownerId, userId, status: "ACTIVE" }, select: { id: true } })
          : null;
    if (!owner) continue;
    for (const account of wallet.accounts) {
      if (account.purpose === "OWNER_WITHDRAWABLE") withdrawable = withdrawable.add(account.currentBalance);
      if (account.purpose === "WITHDRAWAL_HELD") held = held.add(account.currentBalance);
    }
  }
  return Object.freeze({ withdrawableBalance: withdrawable.toFixed(2), heldBalance: held.toFixed(2), destinations });
}

export async function listFinanceWithdrawals(query: AdminListQuery) {
  const where: Prisma.WithdrawalRequestWhereInput = { ...(query.status && { status: query.status }), ...(query.ownerType && { ownerType: query.ownerType }), ...(query.payoutDestinationStatus && { payoutDestination: { status: query.payoutDestinationStatus } }), ...(query.reconciliation !== undefined && { reconciliationCases: query.reconciliation ? { some: { status: { in: ["OPEN", "MONITORING"] } } } : { none: { status: { in: ["OPEN", "MONITORING"] } } } }), ...(query.reference && { publicReference: { contains: query.reference, mode: "insensitive" } }), ...(query.from || query.to ? { createdAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } } : {}) };
  const [total, rows] = await prisma.$transaction([prisma.withdrawalRequest.count({ where }), prisma.withdrawalRequest.findMany({ where, include: financeInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map(financeItem)), pagination: page(query.page, query.pageSize, total) });
}

export async function getFinanceWithdrawal(id: string): Promise<FinanceWithdrawalDetailDto | null> {
  const row = await prisma.withdrawalRequest.findUnique({ where: { id }, include: financeInclude });
  return row ? financeDetail(row) : null;
}

export async function resolveFinanceWithdrawalReference(id: string): Promise<string | null> {
  const withdrawal = await prisma.withdrawalRequest.findUnique({ where: { id }, select: { publicReference: true } });
  return withdrawal?.publicReference ?? null;
}

export async function listFinancePayoutDestinations() {
  const rows = await prisma.payoutDestination.findMany({ select: { publicReference: true, ownerType: true, ownerId: true, maskedLabel: true, institutionName: true, accountLast4: true, countryCode: true, currency: true, status: true, verifiedAt: true, disabledAt: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return Object.freeze(rows.map((row) => Object.freeze({ ...row, currency: "ZAR" as const, verifiedAt: row.verifiedAt?.toISOString() ?? null, disabledAt: row.disabledAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() })));
}

export async function getFinancePayoutDestination(publicReference: string) {
  const row = await prisma.payoutDestination.findUnique({ where: { publicReference }, select: { publicReference: true, ownerType: true, ownerId: true, maskedLabel: true, institutionName: true, accountLast4: true, countryCode: true, currency: true, status: true, verifiedAt: true, disabledAt: true, createdAt: true, withdrawals: { select: { publicReference: true, status: true, amount: true }, orderBy: { createdAt: "desc" }, take: 20 } } });
  if (!row) return null;
  return Object.freeze({ ...row, currency: "ZAR" as const, verifiedAt: row.verifiedAt?.toISOString() ?? null, disabledAt: row.disabledAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), withdrawals: Object.freeze(row.withdrawals.map((withdrawal) => Object.freeze({ publicReference: withdrawal.publicReference, status: withdrawal.status, amount: withdrawal.amount.toFixed(2) }))) });
}

export async function listWithdrawalReconciliation(query: ReconciliationQuery) {
  const where: Prisma.WithdrawalReconciliationCaseWhereInput = { ...(query.status && { status: query.status }), ...(query.reason && { reason: query.reason }) };
  const [total, rows] = await prisma.$transaction([prisma.withdrawalReconciliationCase.count({ where }), prisma.withdrawalReconciliationCase.findMany({ where, include: { withdrawal: { select: { publicReference: true, amount: true } }, payoutAttempt: { select: { publicReference: true } } }, orderBy: [{ lastObservedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map((row) => Object.freeze({ publicReference: row.publicReference, withdrawalReference: row.withdrawal.publicReference, attemptReference: row.payoutAttempt?.publicReference ?? null, amount: row.withdrawal.amount.toFixed(2), reason: row.reason, status: row.status, priority: row.priority, summary: row.safeSummary, observationCount: row.observationCount, openedAt: row.openedAt.toISOString(), lastObservedAt: row.lastObservedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, resolutionCode: row.resolutionCode }))), pagination: page(query.page, query.pageSize, total) });
}

export async function getWithdrawalReconciliation(publicReference: string) {
  const row = await prisma.withdrawalReconciliationCase.findUnique({ where: { publicReference }, include: { withdrawal: { select: { publicReference: true, amount: true } }, payoutAttempt: { select: { publicReference: true, status: true } } } });
  if (!row) return null;
  return Object.freeze({ publicReference: row.publicReference, withdrawalReference: row.withdrawal.publicReference, amount: row.withdrawal.amount.toFixed(2), attempt: row.payoutAttempt ? Object.freeze({ publicReference: row.payoutAttempt.publicReference, status: row.payoutAttempt.status }) : null, reason: row.reason, status: row.status, priority: row.priority, summary: row.safeSummary, safeEvidence: row.safeEvidence, observationCount: row.observationCount, openedAt: row.openedAt.toISOString(), lastObservedAt: row.lastObservedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, resolutionCode: row.resolutionCode });
}
