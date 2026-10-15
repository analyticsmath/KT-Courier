import { Prisma } from "@prisma/client";
import { MarketplaceCheckoutError } from "./errors";

/** Provider status alone is insufficient: the same verified receipt must credit
 * the platform's held funds for precisely the digital allocation. */
export function assertMarketplaceDigitalReceipt(payment: unknown, required: string): void {
  const p = payment as {
    status?: string; amount?: Prisma.Decimal; currency?: string; subjectType?: string;
    successfulAttempt?: { id?: string; status?: string; amount?: Prisma.Decimal } | null;
    successWebhookEvent?: { processingStatus?: string; signatureVerified?: boolean; merchantVerified?: boolean; amountVerified?: boolean; providerDataVerified?: boolean } | null;
    successLedgerJournal?: { type?: string; currency?: string; totalDebits?: Prisma.Decimal; totalCredits?: Prisma.Decimal; entries?: { direction: string; amount: Prisma.Decimal; account: { code: string } }[] } | null;
  } | null;
  const r = p?.successLedgerJournal, w = p?.successWebhookEvent;
  const expected = new Prisma.Decimal(required);
  const credited = r?.entries?.filter(e => e.direction === "CREDIT" && e.account.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR").reduce((sum,e) => sum.add(e.amount),new Prisma.Decimal(0));
  if (!p || p.subjectType !== "MARKETPLACE_CHECKOUT" || p.status !== "SUCCEEDED" || p.currency !== "ZAR" || !p.amount?.equals(expected) || p.successfulAttempt?.status !== "SUCCEEDED" || !w || w.processingStatus !== "APPLIED" || !w.signatureVerified || !w.merchantVerified || !w.amountVerified || !w.providerDataVerified || r?.type !== "EXTERNAL_PAYMENT_RECEIPT" || r.currency !== "ZAR" || !r.totalDebits?.equals(expected) || !r.totalCredits?.equals(expected) || !credited?.equals(expected)) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A source-bound verified digital receipt is required for this marketplace payment plan.");
}
export const marketplaceDigitalReceiptInclude = {
  successfulAttempt: true,
  successWebhookEvent: true,
  successLedgerJournal: { include: { entries: { include: { account: true } } } },
} as const;

export type MarketplaceCashFunding = Readonly<{ publicReference: string; collectorDriverId: string | null; cashCollected: Prisma.Decimal; cashReconciled: Prisma.Decimal; collectionJournalId: string | null; reconciliationJournalId: string | null }>;
/** Receipt pointers must identify the actual two custody postings, not merely
 * non-null IDs. Cash remains a separate funding source from provider receipts. */
export async function assertMarketplaceCashJournals(tx: Pick<Prisma.TransactionClient, "ledgerJournal">, cod: MarketplaceCashFunding): Promise<void> {
  const ids = [cod.collectionJournalId, cod.reconciliationJournalId].filter((id): id is string => Boolean(id));
  const rows = await tx.ledgerJournal.findMany({ where: { id: { in: ids } }, include: { entries: { include: { account: true } } } });
  const collection = rows.find(r => r.id === cod.collectionJournalId), reconciliation = rows.find(r => r.id === cod.reconciliationJournalId);
  const driverCode = `DRIVER-COD-CASH-${cod.collectorDriverId?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`;
  const entry = (journal: typeof collection, code: string, direction: string, amount: Prisma.Decimal) => journal?.entries.filter(e => e.account.code === code && e.direction === direction && e.amount.equals(amount)).length === 1;
  if (ids.length !== 2 || !cod.collectorDriverId || !collection || !reconciliation || rows.length !== 2 || [collection,reconciliation].some(r => r.type !== "GENERAL" || r.currency !== "ZAR" || !r.totalDebits.equals(cod.cashCollected) || !r.totalCredits.equals(cod.cashCollected) || r.entries.length !== 2) || collection.sourceReference !== `cod:${cod.publicReference}:collection` || reconciliation.sourceReference !== `cod:${cod.publicReference}:reconciliation` || !entry(collection,driverCode,"DEBIT",cod.cashCollected) || !entry(collection,"PLATFORM-CUSTOMER-FUNDS-HELD-ZAR","CREDIT",cod.cashCollected) || !entry(reconciliation,driverCode,"CREDIT",cod.cashCollected) || !entry(reconciliation,"PLATFORM-CASH-CLEARING-ZAR","DEBIT",cod.cashReconciled)) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Cash settlement receipt journals do not match the original driver custody and bank remittance.");
}
