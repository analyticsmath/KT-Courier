import Link from "next/link";
import type { PaymentReconciliationListItemDto, PaymentWebhookListItemDto } from "@/lib/dto/payment-confirmation.dto";

const cell = "px-4 py-3 text-left text-sm align-top";
const head = `${cell} text-xs font-black uppercase tracking-wide text-[var(--kt-text-muted)]`;
const label = (value: string) => value.replaceAll("_", " ");
const time = (value: string | null) => value ? new Date(value).toLocaleString("en-ZA") : "—";

export function PaymentWebhooksTable({ events }: { events: readonly PaymentWebhookListItemDto[] }) {
  return <div className="overflow-x-auto rounded-xl border border-[var(--kt-soft-border)]"><table className="min-w-full divide-y divide-[var(--kt-soft-border)]" aria-label="Payment webhooks">
    <thead><tr><th className={head}>Event reference</th><th className={head}>Received</th><th className={head}>Environment</th><th className={head}>Provider status</th><th className={head}>Processing</th><th className={head}>Payment / attempt</th><th className={head}>Amount</th><th className={head}>Reconciliation</th></tr></thead>
    <tbody className="divide-y divide-[var(--kt-soft-border)]">{events.length === 0 ? <tr><td className={`${cell} text-center text-[var(--kt-text-muted)]`} colSpan={8}>No payment webhooks match these filters.</td></tr> : events.map((event) => <tr key={event.publicReference}>
      <td className={cell}><Link href={`/admin/payment-webhooks/${event.publicReference}`} className="font-mono font-bold text-[var(--kt-signal-cobalt)]">{event.publicReference}</Link></td><td className={cell}>{time(event.receivedAt)}</td><td className={cell}>{label(event.environment)}</td><td className={cell}>{label(event.normalizedStatus)}</td><td className={cell}>{label(event.processingStatus)}</td><td className={`${cell} font-mono text-xs`}>{event.paymentReference ?? "—"}<br />{event.attemptReference ?? "—"}</td><td className={`${cell} font-mono`}>{event.amount ?? "—"}</td><td className={cell}>{event.reconciliationRequired ? "Required" : "No case"}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function PaymentReconciliationTable({ cases }: { cases: readonly PaymentReconciliationListItemDto[] }) {
  return <div className="overflow-x-auto rounded-xl border border-[var(--kt-soft-border)]"><table className="min-w-full divide-y divide-[var(--kt-soft-border)]" aria-label="Payment reconciliation cases">
    <thead><tr><th className={head}>Case reference</th><th className={head}>Status</th><th className={head}>Priority</th><th className={head}>Reason</th><th className={head}>Payment / attempt</th><th className={head}>Observations</th><th className={head}>Last observed</th></tr></thead>
    <tbody className="divide-y divide-[var(--kt-soft-border)]">{cases.length === 0 ? <tr><td className={`${cell} text-center text-[var(--kt-text-muted)]`} colSpan={7}>No payment reconciliation cases match these filters.</td></tr> : cases.map((entry) => <tr key={entry.publicReference}>
      <td className={cell}><Link href={`/admin/payment-reconciliation/${entry.publicReference}`} className="font-mono font-bold text-[var(--kt-signal-cobalt)]">{entry.publicReference}</Link></td><td className={cell}>{label(entry.status)}</td><td className={cell}>{entry.priority}</td><td className={cell}>{label(entry.reason)}</td><td className={`${cell} font-mono text-xs`}>{entry.paymentReference}<br />{entry.attemptReference ?? "—"}</td><td className={cell}>{entry.observationCount}</td><td className={cell}>{time(entry.lastObservedAt)}</td>
    </tr>)}</tbody>
  </table></div>;
}

export const confirmationTimeLabel = time;
export const confirmationStatusLabel = label;
