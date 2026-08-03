import type { Metadata } from "next";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { LedgerAccountFilters, LedgerJournalFilters } from "@/components/admin/LedgerFilters";
import { LedgerPagination } from "@/components/admin/LedgerPagination";
import { LedgerAccountTable, LedgerJournalTable } from "@/components/admin/LedgerTables";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listLedgerAccounts, listLedgerJournals } from "@/lib/services/ledger-query.service";
import { LedgerAccountQuerySchema, LedgerJournalQuerySchema } from "@/lib/validation/ledger";

export const metadata: Metadata = { title: "Ledger" };

type SearchParams = Record<string, string | string[] | undefined>;
const value = (params: SearchParams, key: string) => {
  const candidate = params[key];
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
};

export default async function AdminLedgerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPagePermission(PERMISSIONS.LEDGER_READ);
  const params = await searchParams;
  const accountInput = {
    page: value(params, "accountPage") ?? "1",
    pageSize: "20",
    code: value(params, "accountCode"),
    ownerType: value(params, "ownerType"),
    purpose: value(params, "purpose"),
    status: value(params, "accountStatus"),
    nonZero: value(params, "nonZero"),
  };
  const journalInput = {
    page: value(params, "journalPage") ?? "1",
    pageSize: "20",
    reference: value(params, "journalReference"),
    type: value(params, "journalType"),
    reversalState: value(params, "reversalState"),
  };
  const accountQuery = LedgerAccountQuerySchema.safeParse(accountInput);
  const journalQuery = LedgerJournalQuerySchema.safeParse(journalInput);

  let content: React.ReactNode;
  if (!accountQuery.success || !journalQuery.success) {
    content = <ErrorPanel title="Invalid ledger filters" message="Review the account and journal filters, then try again." />;
  } else {
    let accountsData: Awaited<ReturnType<typeof listLedgerAccounts>> | null = null;
    let journalsData: Awaited<ReturnType<typeof listLedgerJournals>> | null = null;
    let loadFailed = false;
    try {
      const [accounts, journals] = await Promise.all([
        listLedgerAccounts(accountQuery.data),
        listLedgerJournals(journalQuery.data),
      ]);
      accountsData = accounts;
      journalsData = journals;
    } catch {
      loadFailed = true;
    }

    if (loadFailed || !accountsData || !journalsData) {
      content = <ErrorPanel title="Ledger unavailable" message="The read-only ledger view could not be loaded. Please try again." />;
    } else {
      content = <>
        <OperationalPanel className="space-y-4">
          <div><h2 className="text-lg font-black text-[var(--kt-ink-navy)]">Ledger accounts</h2><p className="text-sm text-[var(--kt-text-muted)]">Transactionally maintained projections backed by immutable entries.</p></div>
          <LedgerAccountFilters values={{ accountCode: accountInput.code, ownerType: accountInput.ownerType, purpose: accountInput.purpose, accountStatus: accountInput.status, nonZero: accountInput.nonZero }} />
          <LedgerAccountTable accounts={accountsData.data} />
          <LedgerPagination pathname="/admin/ledger" searchParams={params} pageParameter="accountPage" page={accountsData.pagination.page} totalPages={accountsData.pagination.totalPages} label="Ledger account pages" />
        </OperationalPanel>
        <OperationalPanel className="space-y-4">
          <div><h2 className="text-lg font-black text-[var(--kt-ink-navy)]">Ledger journals</h2><p className="text-sm text-[var(--kt-text-muted)]">Final balanced financial events. This interface is read-only.</p></div>
          <LedgerJournalFilters values={{ journalReference: journalInput.reference, journalType: journalInput.type, reversalState: journalInput.reversalState }} />
          <LedgerJournalTable journals={journalsData.data} />
          <LedgerPagination pathname="/admin/ledger" searchParams={params} pageParameter="journalPage" page={journalsData.pagination.page} totalPages={journalsData.pagination.totalPages} label="Ledger journal pages" />
        </OperationalPanel>
      </>;
    }
  }

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Finance audit" title="Ledger" description="Inspect wallet accounts, immutable journals, and double-entry evidence. No posting controls are available." />
    {content}
  </ProtectedPageFrame>;
}
