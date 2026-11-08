import Link from "next/link";
import type { getStoreOperationsSnapshot } from "@/lib/services/admin-store-operations.service";
import type { DashboardPeriod } from "@/lib/dashboard-insights/types";

type Snapshot = Awaited<ReturnType<typeof getStoreOperationsSnapshot>>;
const PERIODS: readonly DashboardPeriod[] = ["TODAY", "7_DAYS", "30_DAYS", "12_WEEKS"];
const LABELS: Record<string, string> = {
  WAITING_FOR_STORE: "Awaiting store review", ACCEPTED: "Accepted", PACKING: "Packing / ready",
  OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered", CANCELLED: "Cancelled",
  REFUNDED: "Refund completed", REQUIRES_ACTION: "Requires intervention",
};

export function StoreOperationsPanel({ snapshot, statusFilter }: { snapshot: Snapshot; statusFilter: string }) {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--kt-brand-navy)]">Store orders and paid product activity</h2>
          <p className="mt-1 text-sm text-[var(--kt-text-soft)]">{snapshot.windowLabel}</p>
        </div>
        <nav aria-label="Store performance reporting period" className="flex flex-wrap gap-2">
          {PERIODS.map(period =>
            <Link key={period} href={"/admin/stores?status=" + encodeURIComponent(statusFilter) + "&period=" + period}
              aria-current={snapshot.period === period ? "page" : undefined}
              className={"rounded-full border px-3 py-2 text-sm font-medium " +
                (snapshot.period === period ? "border-[var(--kt-brand-navy)] bg-[var(--kt-brand-navy)] text-white" : "border-[var(--kt-border)]")}>
              {period === "TODAY" ? "Today" : period === "7_DAYS" ? "7 days" : period === "30_DAYS" ? "30 days" : "12 weeks"}
            </Link>,
          )}
        </nav>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["Store accounts", String(snapshot.accountCounts.total)],
          ["Active store accounts", String(snapshot.accountCounts.active)],
          ["Awaiting approval", String(snapshot.accountCounts.pending)],
          ["Live store orders", String(snapshot.totalStoreOrders)],
          ["Failed payment attempts", String(snapshot.failedMarketplacePaymentAttempts)],
          ["Action-required orders", String(snapshot.counts.REQUIRES_ACTION)],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--kt-border)] bg-[var(--kt-surface-muted)] p-4">
          <dt className="text-xs text-[var(--kt-text-soft)]">{label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
        </div>)}
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-semibold">Operational order statuses</h3>
          <dl className="divide-y divide-[var(--kt-border)] rounded-xl border border-[var(--kt-border)] px-4">
            {Object.entries(snapshot.counts).map(([key, value]) =>
              <div key={key} className="flex justify-between gap-3 py-3 text-sm">
                <dt>{LABELS[key] ?? key}</dt><dd className="font-semibold tabular-nums">{value}</dd>
              </div>,
            )}
          </dl>
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold">Top 10 stores by paid merchandise sales</h3>
          {snapshot.paidTopStores.length ? <ol className="divide-y divide-[var(--kt-border)] rounded-xl border border-[var(--kt-border)] px-4">
            {snapshot.paidTopStores.map(row =>
              <li key={row.id} className="flex justify-between gap-4 py-3 text-sm">
                <div><Link href={"/admin/stores/" + encodeURIComponent(row.id)} className="font-semibold underline">{row.name}</Link>
                  <span className="block text-xs text-[var(--kt-text-soft)]">{row.paidStoreOrders} paid store orders</span></div>
                <span className="font-semibold tabular-nums">R {row.merchandise}</span>
              </li>)}
          </ol> : <p className="text-sm text-[var(--kt-text-soft)]">No verified paid store sales in this period.</p>}
        </div>
        <div className="space-y-3 lg:col-span-2">
          <h3 className="font-semibold">Top 10 items by units in paid orders</h3>
          {snapshot.paidTopItems.length ? <div className="overflow-x-auto rounded-xl border border-[var(--kt-border)]">
            <table className="min-w-full text-sm"><thead className="bg-[var(--kt-surface-muted)]"><tr>
              <th scope="col" className="px-4 py-3 text-left">Item</th>
              <th scope="col" className="px-4 py-3 text-right">Units</th>
              <th scope="col" className="px-4 py-3 text-right">Paid merchandise</th>
            </tr></thead><tbody className="divide-y divide-[var(--kt-border)]">
              {snapshot.paidTopItems.map(item => <tr key={item.reference + item.title}>
                <td className="px-4 py-3">{item.title}</td>
                <td className="px-4 py-3 text-right tabular-nums">{item.units}</td>
                <td className="px-4 py-3 text-right tabular-nums">R {item.sales}</td>
              </tr>)}
            </tbody></table>
          </div> : <p className="text-sm text-[var(--kt-text-soft)]">No verified paid items in this period.</p>}
        </div>
      </div>
      <div className="space-y-1 text-xs leading-5 text-[var(--kt-text-soft)]">
        {snapshot.caveats.map(message => <p key={message}>{message}</p>)}
      </div>
    </section>
  );
}
