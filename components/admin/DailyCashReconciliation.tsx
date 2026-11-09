import Link from "next/link";
import type { getDailyDriverCashReconciliation } from "@/lib/client-platform/driver-cash-reconciliation-dashboard.service";

type Overview = Awaited<ReturnType<typeof getDailyDriverCashReconciliation>>;

export function DailyCashReconciliation({ overview }: { overview: Overview }) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--kt-brand-navy)]">Daily driver cash reconciliation</h2>
          <p className="mt-2 text-sm text-[var(--kt-text-soft)]">
            South Africa operating date: {overview.date}. Real ledger custody, outstanding prior-day deposits,
            and pending submissions are shown separately.
          </p>
        </div>
        <span className="rounded-full border border-[var(--kt-border)] px-3 py-1 text-sm">{overview.driverCount} driver profiles</span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["Driver cash still held", overview.totalHeld],
          ["Unreconciled from prior days", overview.totalOvernight],
          ["Drivers at/over cash cap", String(overview.atLimitCount)],
        ].map(([label, value], index) => (
          <div className="rounded-lg border border-[var(--kt-border)] bg-[var(--kt-surface-muted)] p-4" key={label}>
            <dt className="text-xs text-[var(--kt-text-soft)]">{label}</dt>
            <dd className="mt-1 text-xl font-semibold">{index === 2 ? value : "R " + value}</dd>
          </div>
        ))}
      </dl>
      <p role="status" className="text-sm leading-6 text-[var(--kt-text-soft)]">{overview.note}</p>
      {overview.hasMoreDrivers && <p className="text-sm font-medium">Showing the first 500 driver profiles; totals are limited to the visible set. Export a full audit before sign-off.</p>}
      <div className="overflow-x-auto rounded-xl border border-[var(--kt-border)]">
        <table className="min-w-full divide-y divide-[var(--kt-border)] text-left text-sm">
          <thead className="bg-[var(--kt-surface-muted)]">
            <tr>{["Driver / status", "Held", "Reserved / cap", "Overnight outstanding", "Deposits awaiting review"].map(label =>
              <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[var(--kt-border)]">
            {overview.drivers.filter(row => row.held !== "0.00" || row.reserved !== "0.00" || row.pendingDepositCount > 0 || row.atLimit || row.overnightOrderCount > 0).map(row =>
              <tr key={row.id}>
                <td className="px-4 py-3"><Link href={"/admin/drivers/" + encodeURIComponent(row.id)} className="font-semibold underline">{row.name}</Link><span className="block text-xs text-[var(--kt-text-soft)]">{row.driverCode} · {row.status}</span></td>
                <td className="px-4 py-3 tabular-nums">R {row.held}</td>
                <td className="px-4 py-3 tabular-nums">R {row.reserved} reserved / R {row.limit} limit{row.atLimit && <strong className="block text-xs text-[var(--kt-red)]">At limit</strong>}</td>
                <td className="px-4 py-3 tabular-nums">R {row.overnightOutstanding}<span className="block text-xs">{row.overnightOrderCount} orders</span></td>
                <td className="px-4 py-3 tabular-nums">R {row.pendingDepositAmount}<span className="block text-xs">{row.pendingDepositCount} submissions</span></td>
              </tr>,
            )}
          </tbody>
        </table>
      </div>
      {overview.drivers.every(row => row.held === "0.00" && row.reserved === "0.00" && row.pendingDepositCount === 0 && row.overnightOrderCount === 0) &&
        <p className="text-sm text-[var(--kt-text-soft)]">No outstanding driver cash custody in the displayed records.</p>}
    </section>
  );
}
