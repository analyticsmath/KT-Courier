import Link from "next/link";
import type {
  LedgerAccountSummaryDto,
  LedgerEntryDto,
  LedgerJournalSummaryDto,
} from "@/lib/dto/ledger.dto";
import { formatLedgerTimestamp, formatZarLedgerAmount } from "@/lib/ledger/format";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const headerClass = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--kt-text-muted)]";
const cellClass = "px-4 py-3 text-sm text-[var(--kt-text-soft)]";

function tableShell(children: React.ReactNode) {
  return <div className="overflow-x-auto rounded-xl border border-[var(--kt-border)]">{children}</div>;
}

export function LedgerAccountTable({ accounts }: { accounts: readonly LedgerAccountSummaryDto[] }) {
  if (accounts.length === 0) return <EmptyState title="No ledger accounts" description="No accounts match the current filters." />;
  return tableShell(
    <table className="w-full" aria-label="Ledger accounts">
      <thead className="bg-[var(--kt-surface-muted)]"><tr>
        <th className={headerClass} scope="col">Account</th><th className={headerClass} scope="col">Owner</th>
        <th className={headerClass} scope="col">Purpose</th><th className={headerClass} scope="col">Category</th>
        <th className={headerClass} scope="col">Status</th><th className={headerClass} scope="col">Current balance</th>
      </tr></thead>
      <tbody className="divide-y divide-[var(--kt-border)]">
        {accounts.map((account) => <tr key={account.id}>
          <td className={cellClass}><Link className="font-mono font-semibold text-[var(--kt-signal-cobalt)]" href={`/admin/ledger/accounts/${account.id}`}>{account.code}</Link></td>
          <td className={cellClass}>{account.owner.label}<span className="block text-xs text-[var(--kt-text-muted)]">{account.owner.type}</span></td>
          <td className={cellClass}>{account.purpose}</td><td className={cellClass}>{account.category}</td>
          <td className={cellClass}><Badge variant={account.status === "ACTIVE" ? "green" : account.status === "FROZEN" ? "amber" : "slate"}>{account.status}</Badge></td>
          <td className={`${cellClass} font-mono font-semibold`}>{formatZarLedgerAmount(account.currentBalance)}</td>
        </tr>)}
      </tbody>
    </table>
  );
}

export function LedgerJournalTable({ journals }: { journals: readonly LedgerJournalSummaryDto[] }) {
  if (journals.length === 0) return <EmptyState title="No ledger journals" description="No posted journals match the current filters." />;
  return tableShell(
    <table className="w-full" aria-label="Ledger journals">
      <thead className="bg-[var(--kt-surface-muted)]"><tr>
        <th className={headerClass} scope="col">Reference</th><th className={headerClass} scope="col">Type</th>
        <th className={headerClass} scope="col">Debits</th><th className={headerClass} scope="col">Credits</th>
        <th className={headerClass} scope="col">Validation</th><th className={headerClass} scope="col">Posted</th>
      </tr></thead>
      <tbody className="divide-y divide-[var(--kt-border)]">
        {journals.map((journal) => <tr key={journal.id}>
          <td className={cellClass}><Link className="font-mono font-semibold text-[var(--kt-signal-cobalt)]" href={`/admin/ledger/journals/${journal.id}`}>{journal.reference}</Link></td>
          <td className={cellClass}>{journal.type}</td>
          <td className={`${cellClass} font-mono`}>{formatZarLedgerAmount(journal.totalDebits)}</td>
          <td className={`${cellClass} font-mono`}>{formatZarLedgerAmount(journal.totalCredits)}</td>
          <td className={cellClass}><Badge variant={journal.balanced ? "green" : "red"}>{journal.balanced ? "Balanced" : "Invalid"}</Badge></td>
          <td className={cellClass}>{formatLedgerTimestamp(journal.postedAt)}</td>
        </tr>)}
      </tbody>
    </table>
  );
}

export function LedgerEntryTable({ entries, context }: { entries: readonly LedgerEntryDto[]; context: "account" | "journal" }) {
  if (entries.length === 0) return <EmptyState title="No ledger entries" description="This ledger account has no immutable entry evidence yet." />;
  return tableShell(
    <table className="w-full" aria-label={context === "journal" ? "Journal entries" : "Account entries"}>
      <thead className="bg-[var(--kt-surface-muted)]"><tr>
        <th className={headerClass} scope="col">Sequence</th><th className={headerClass} scope="col">Account</th>
        <th className={headerClass} scope="col">Direction</th><th className={headerClass} scope="col">Debit amount</th><th className={headerClass} scope="col">Credit amount</th>
        <th className={headerClass} scope="col">Line code</th><th className={headerClass} scope="col">Journal</th>
      </tr></thead>
      <tbody className="divide-y divide-[var(--kt-border)]">
        {entries.map((entry) => <tr key={entry.id}>
          <td className={cellClass}>{entry.sequence}</td>
          <td className={cellClass}><Link className="font-mono text-[var(--kt-signal-cobalt)]" href={`/admin/ledger/accounts/${entry.account.id}`}>{entry.account.code}</Link></td>
          <td className={cellClass}><Badge variant={entry.direction === "DEBIT" ? "blue" : "purple"}>{entry.direction}</Badge></td>
          <td className={`${cellClass} font-mono font-semibold`}>{entry.direction === "DEBIT" ? formatZarLedgerAmount(entry.amount) : "—"}</td>
          <td className={`${cellClass} font-mono font-semibold`}>{entry.direction === "CREDIT" ? formatZarLedgerAmount(entry.amount) : "—"}</td>
          <td className={`${cellClass} font-mono`}>{entry.lineCode}</td>
          <td className={cellClass}><Link className="font-mono text-[var(--kt-signal-cobalt)]" href={`/admin/ledger/journals/${entry.journal.id}`}>{entry.journal.reference}</Link></td>
        </tr>)}
      </tbody>
    </table>
  );
}
