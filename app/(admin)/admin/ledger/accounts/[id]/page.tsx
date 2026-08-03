import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { LedgerEntryTable } from "@/components/admin/LedgerTables";
import { LedgerPagination } from "@/components/admin/LedgerPagination";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { formatZarLedgerAmount } from "@/lib/ledger/format";
import { getLedgerAccountDetail } from "@/lib/services/ledger-query.service";
import { LedgerPaginationSchema } from "@/lib/validation/ledger";

export const metadata: Metadata = { title: "Ledger account" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function LedgerAccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdminPagePermission(PERMISSIONS.LEDGER_READ);
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const parsed = LedgerPaginationSchema.safeParse({ page: typeof queryParams.page === "string" ? queryParams.page : "1", pageSize: "20" });
  if (!parsed.success) return <ErrorPanel title="Invalid pagination" message="The requested account entry page is invalid." />;
  const detail = await getLedgerAccountDetail(id, parsed.data);
  if (!detail) notFound();

  const account = detail.account;
  return <div className="max-w-6xl space-y-6">
    <ProtectedPageHeader eyebrow="Finance audit" title="Ledger account" description={account.code} />
    <AdministrationPanel>
      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Current balance</dt><dd className="mt-1 font-mono text-xl font-black">{formatZarLedgerAmount(account.currentBalance)}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Cumulative debits</dt><dd className="mt-1 font-mono">{formatZarLedgerAmount(account.debitTotal)}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Cumulative credits</dt><dd className="mt-1 font-mono">{formatZarLedgerAmount(account.creditTotal)}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Owner</dt><dd className="mt-1">{account.owner.label} ({account.owner.type})</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Purpose</dt><dd className="mt-1">{account.purpose}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Category</dt><dd className="mt-1">{account.category}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Status</dt><dd className="mt-1">{account.status}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Projection version</dt><dd className="mt-1">{account.version}</dd></div>
      </dl>
    </AdministrationPanel>
    <AdministrationPanel className="space-y-4">
      <div><h2 className="text-lg font-black text-[var(--kt-ink-navy)]">Account entries</h2><p className="text-sm text-[var(--kt-text-muted)]">Immutable journal lines ordered newest first.</p></div>
      <LedgerEntryTable entries={detail.entries} context="account" />
      <LedgerPagination pathname={`/admin/ledger/accounts/${id}`} searchParams={queryParams} pageParameter="page" page={detail.pagination.page} totalPages={detail.pagination.totalPages} label="Account entry pages" />
    </AdministrationPanel>
  </div>;
}

