import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { LedgerEntryTable } from "@/components/admin/LedgerTables";
import { Badge } from "@/components/ui/Badge";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { formatLedgerTimestamp, formatZarLedgerAmount } from "@/lib/ledger/format";
import { getLedgerJournalDetail } from "@/lib/services/ledger-query.service";

export const metadata: Metadata = { title: "Ledger journal" };

export default async function LedgerJournalPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.LEDGER_READ);
  const { id } = await params;
  const journal = await getLedgerJournalDetail(id);
  if (!journal) notFound();

  return <div className="max-w-6xl space-y-6">
    <ProtectedPageHeader eyebrow="Finance audit" title="Ledger journal" description={journal.reference} />
    <AdministrationPanel className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Validation</p><Badge variant={journal.balanced ? "green" : "red"}>{journal.balanced ? "Balanced journal" : "Invalid journal"}</Badge></div>
        <div className="text-right"><p className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Posted</p><p>{formatLedgerTimestamp(journal.postedAt)}</p></div>
      </div>
      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Total debits</dt><dd className="mt-1 font-mono text-lg font-black">{formatZarLedgerAmount(journal.totalDebits)}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Total credits</dt><dd className="mt-1 font-mono text-lg font-black">{formatZarLedgerAmount(journal.totalCredits)}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Type</dt><dd className="mt-1">{journal.type}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Policy</dt><dd className="mt-1">{journal.policyVersion}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Source reference</dt><dd className="mt-1">{journal.sourceReference ?? "Not supplied"}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Correlation ID</dt><dd className="mt-1">{journal.correlationId ?? "Not supplied"}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Original journal</dt><dd className="mt-1">{journal.originalJournal ? <Link className="text-[var(--kt-signal-cobalt)]" href={`/admin/ledger/journals/${journal.originalJournal.id}`}>{journal.originalJournal.reference}</Link> : "Not a reversal"}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Reversal journal</dt><dd className="mt-1">{journal.reversalJournal ? <Link className="text-[var(--kt-signal-cobalt)]" href={`/admin/ledger/journals/${journal.reversalJournal.id}`}>{journal.reversalJournal.reference}</Link> : "Not reversed"}</dd></div>
      </dl>
    </AdministrationPanel>
    <AdministrationPanel className="space-y-4"><h2 className="text-lg font-black text-[var(--kt-ink-navy)]">Journal entries</h2><LedgerEntryTable entries={journal.entries} context="journal" /></AdministrationPanel>
    <AdministrationPanel className="space-y-3">
      <h2 className="text-lg font-black text-[var(--kt-ink-navy)]">Safe metadata</h2>
      {journal.metadataRedacted ? <p role="status">Metadata was redacted because it did not satisfy the ledger safety policy.</p> : journal.metadata ? <p role="status">Safe journal metadata is recorded. This protected view does not render a raw metadata payload.</p> : <p className="text-sm text-[var(--kt-text-muted)]">No metadata recorded.</p>}
    </AdministrationPanel>
  </div>;
}
