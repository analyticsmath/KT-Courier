import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  LedgerAccountDetailDto,
  LedgerAccountListDto,
  LedgerAccountSummaryDto,
  LedgerEntryDto,
  LedgerJournalDetailDto,
  LedgerJournalListDto,
  LedgerJournalSummaryDto,
  SafeLedgerOwnerDto,
} from "@/lib/dto/ledger.dto";
import { sanitizeLedgerMetadata } from "@/lib/ledger/metadata";
import type { LedgerOwnerTypeCode, SafeLedgerMetadata } from "@/lib/ledger/types";
import type { LedgerAccountQuery, LedgerJournalQuery, LedgerPagination } from "@/lib/validation/ledger";

type WalletOwnerRow = { ownerType: LedgerOwnerTypeCode; ownerId: string };

function pagination(page: number, pageSize: number, total: number) {
  return Object.freeze({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

async function resolveOwnerSummaries(wallets: readonly WalletOwnerRow[]): Promise<Map<string, SafeLedgerOwnerDto>> {
  const ownerIds = (type: LedgerOwnerTypeCode) => [...new Set(wallets.filter((wallet) => wallet.ownerType === type).map((wallet) => wallet.ownerId))];
  const customerIds = ownerIds("CUSTOMER");
  const storeIds = ownerIds("STORE");
  const driverIds = ownerIds("DRIVER");
  const promoterIds = ownerIds("PROMOTER");
  const [customers, stores, drivers, promoters] = await Promise.all([
    customerIds.length ? prisma.user.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } }) : [],
    storeIds.length ? prisma.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } }) : [],
    driverIds.length ? prisma.driverProfile.findMany({ where: { id: { in: driverIds } }, select: { id: true, displayName: true, driverCode: true } }) : [],
    promoterIds.length ? prisma.promoterProfile.findMany({ where: { id: { in: promoterIds } }, select: { id: true, displayName: true, promoterCode: true } }) : [],
  ]);
  const labels = new Map<string, string>();
  for (const customer of customers) labels.set(`CUSTOMER:${customer.id}`, customer.name?.trim() || "Customer");
  for (const store of stores) labels.set(`STORE:${store.id}`, store.name);
  for (const driver of drivers) labels.set(`DRIVER:${driver.id}`, driver.displayName?.trim() || driver.driverCode);
  for (const promoter of promoters) labels.set(`PROMOTER:${promoter.id}`, promoter.displayName?.trim() || promoter.promoterCode);

  const result = new Map<string, SafeLedgerOwnerDto>();
  for (const wallet of wallets) {
    const key = `${wallet.ownerType}:${wallet.ownerId}`;
    result.set(key, Object.freeze({
      type: wallet.ownerType,
      id: wallet.ownerId,
      label: wallet.ownerType === "PLATFORM" ? "KT Couriers platform" : labels.get(key) ?? wallet.ownerType.toLowerCase(),
    }));
  }
  return result;
}

function accountDto(account: {
  id: string;
  walletId: string;
  code: string;
  purpose: LedgerAccountSummaryDto["purpose"];
  category: LedgerAccountSummaryDto["category"];
  currency: LedgerAccountSummaryDto["currency"];
  status: LedgerAccountSummaryDto["status"];
  allowNegative: boolean;
  currentBalance: Prisma.Decimal;
  debitTotal: Prisma.Decimal;
  creditTotal: Prisma.Decimal;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  wallet: WalletOwnerRow;
}, owners: Map<string, SafeLedgerOwnerDto>): LedgerAccountSummaryDto {
  const ownerKey = `${account.wallet.ownerType}:${account.wallet.ownerId}`;
  const owner = owners.get(ownerKey);
  if (!owner) throw new Error("LEDGER_SAFE_OWNER_SUMMARY_MISSING");
  return Object.freeze({
    id: account.id,
    walletId: account.walletId,
    code: account.code,
    purpose: account.purpose,
    category: account.category,
    currency: account.currency,
    status: account.status,
    allowNegative: account.allowNegative,
    currentBalance: account.currentBalance.toFixed(2),
    debitTotal: account.debitTotal.toFixed(2),
    creditTotal: account.creditTotal.toFixed(2),
    version: account.version,
    owner,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  });
}

function entryDto(entry: {
  id: string;
  sequence: number;
  direction: LedgerEntryDto["direction"];
  amount: Prisma.Decimal;
  lineCode: string;
  memo: string | null;
  createdAt: Date;
  account: LedgerEntryDto["account"];
  journal: { id: string; reference: string; type: LedgerEntryDto["journal"]["type"]; postedAt: Date };
}): LedgerEntryDto {
  return Object.freeze({
    id: entry.id,
    sequence: entry.sequence,
    direction: entry.direction,
    amount: entry.amount.toFixed(2),
    lineCode: entry.lineCode,
    memo: entry.memo,
    createdAt: entry.createdAt.toISOString(),
    account: Object.freeze(entry.account),
    journal: Object.freeze({ ...entry.journal, postedAt: entry.journal.postedAt.toISOString() }),
  });
}

function journalDto(journal: {
  id: string;
  reference: string;
  type: LedgerJournalSummaryDto["type"];
  currency: LedgerJournalSummaryDto["currency"];
  totalDebits: Prisma.Decimal;
  totalCredits: Prisma.Decimal;
  sourceReference: string | null;
  correlationId: string | null;
  postedAt: Date;
  originalJournal: { id: string; reference: string } | null;
  reversalJournal: { id: string; reference: string } | null;
}): LedgerJournalSummaryDto {
  return Object.freeze({
    id: journal.id,
    reference: journal.reference,
    type: journal.type,
    currency: journal.currency,
    totalDebits: journal.totalDebits.toFixed(2),
    totalCredits: journal.totalCredits.toFixed(2),
    balanced: journal.totalDebits.equals(journal.totalCredits),
    sourceReference: journal.sourceReference,
    correlationId: journal.correlationId,
    postedAt: journal.postedAt.toISOString(),
    originalJournal: journal.originalJournal ? Object.freeze(journal.originalJournal) : null,
    reversalJournal: journal.reversalJournal ? Object.freeze(journal.reversalJournal) : null,
  });
}

const journalRelations = {
  originalJournal: { select: { id: true, reference: true } },
  reversalJournal: { select: { id: true, reference: true } },
} as const;

export async function listLedgerAccounts(query: LedgerAccountQuery): Promise<LedgerAccountListDto> {
  const where: Prisma.LedgerAccountWhereInput = {
    ...(query.code && { code: { contains: query.code, mode: "insensitive" } }),
    ...(query.purpose && { purpose: query.purpose }),
    ...(query.category && { category: query.category }),
    ...(query.currency && { currency: query.currency }),
    ...(query.status && { status: query.status }),
    ...(query.nonZero !== undefined && { currentBalance: query.nonZero ? { not: new Prisma.Decimal(0) } : new Prisma.Decimal(0) }),
    ...(query.ownerType && { wallet: { ownerType: query.ownerType } }),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.ledgerAccount.count({ where }),
    prisma.ledgerAccount.findMany({
      where,
      include: { wallet: { select: { ownerType: true, ownerId: true } } },
      orderBy: [{ code: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  const owners = await resolveOwnerSummaries(rows.map((row) => row.wallet));
  return Object.freeze({
    data: Object.freeze(rows.map((row) => accountDto(row, owners))),
    pagination: pagination(query.page, query.pageSize, total),
  });
}

export async function getLedgerAccountDetail(
  id: string,
  query: LedgerPagination
): Promise<LedgerAccountDetailDto | null> {
  const account = await prisma.ledgerAccount.findUnique({
    where: { id },
    include: { wallet: { select: { ownerType: true, ownerId: true } } },
  });
  if (!account) return null;
  const [entryCount, entries] = await prisma.$transaction([
    prisma.ledgerEntry.count({ where: { accountId: id } }),
    prisma.ledgerEntry.findMany({
      where: { accountId: id },
      include: {
        account: { select: { id: true, code: true, purpose: true, category: true } },
        journal: { select: { id: true, reference: true, type: true, postedAt: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  const owners = await resolveOwnerSummaries([account.wallet]);
  return Object.freeze({
    account: accountDto(account, owners),
    entries: Object.freeze(entries.map(entryDto)),
    pagination: pagination(query.page, query.pageSize, entryCount),
  });
}

export async function listLedgerJournals(query: LedgerJournalQuery): Promise<LedgerJournalListDto> {
  const where: Prisma.LedgerJournalWhereInput = {
    ...(query.from || query.to ? { postedAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } } : {}),
    ...(query.reference && { reference: { contains: query.reference, mode: "insensitive" } }),
    ...(query.type && { type: query.type }),
    ...(query.sourceReference && { sourceReference: { contains: query.sourceReference, mode: "insensitive" } }),
    ...(query.correlationId && { correlationId: { contains: query.correlationId, mode: "insensitive" } }),
    ...(query.accountId && { entries: { some: { accountId: query.accountId } } }),
    ...(query.reversalState === "REVERSAL" && { reversalOfJournalId: { not: null } }),
    ...(query.reversalState === "ORIGINAL" && { reversalOfJournalId: null }),
    ...(query.reversalState === "REVERSED" && { reversalOfJournalId: null, reversalJournal: { isNot: null } }),
    ...(query.reversalState === "UNREVERSED" && { reversalOfJournalId: null, reversalJournal: { is: null } }),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.ledgerJournal.count({ where }),
    prisma.ledgerJournal.findMany({
      where,
      include: journalRelations,
      orderBy: [{ postedAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return Object.freeze({
    data: Object.freeze(rows.map(journalDto)),
    pagination: pagination(query.page, query.pageSize, total),
  });
}

function safeMetadata(value: Prisma.JsonValue | null): { metadata: SafeLedgerMetadata | null; redacted: boolean } {
  if (value === null) return { metadata: null, redacted: false };
  try {
    return { metadata: sanitizeLedgerMetadata(value) ?? null, redacted: false };
  } catch {
    return { metadata: null, redacted: true };
  }
}

export async function getLedgerJournalDetail(id: string): Promise<LedgerJournalDetailDto | null> {
  const journal = await prisma.ledgerJournal.findUnique({
    where: { id },
    include: {
      ...journalRelations,
      entries: {
        include: {
          account: { select: { id: true, code: true, purpose: true, category: true } },
          journal: { select: { id: true, reference: true, type: true, postedAt: true } },
        },
        orderBy: { sequence: "asc" },
      },
    },
  });
  if (!journal) return null;
  const metadata = safeMetadata(journal.metadata);
  return Object.freeze({
    ...journalDto(journal),
    memo: journal.memo,
    policyVersion: journal.policyVersion,
    metadata: metadata.metadata,
    metadataRedacted: metadata.redacted,
    entries: Object.freeze(journal.entries.map(entryDto)),
  });
}
