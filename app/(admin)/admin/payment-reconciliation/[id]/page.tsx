import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { confirmationStatusLabel, confirmationTimeLabel } from "@/components/admin/PaymentConfirmationTables";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPaymentReconciliationDetail } from "@/lib/services/payment-confirmation-query.service";

export const metadata: Metadata = { title: "Payment reconciliation details" };
export default async function PaymentReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.PAYMENT_RECONCILIATION_READ);
  const { id } = await params;
  const item = await getPaymentReconciliationDetail(id);
  if (!item) notFound();
  return <div className="max-w-5xl space-y-6"><ProtectedPageHeader eyebrow="Provider evidence" title="Payment Reconciliation" description={item.publicReference} />
    <AdministrationPanel><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Status</dt><dd>{item.status}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Priority</dt><dd>{item.priority}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Reason</dt><dd>{confirmationStatusLabel(item.reason)}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Payment</dt><dd className="font-mono text-xs">{item.paymentReference}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Attempt</dt><dd className="font-mono text-xs">{item.attemptReference ?? "—"}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Observations</dt><dd>{item.observationCount}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Opened</dt><dd>{confirmationTimeLabel(item.openedAt)}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Last observed</dt><dd>{confirmationTimeLabel(item.lastObservedAt)}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Resolved</dt><dd>{confirmationTimeLabel(item.resolvedAt)}</dd></div></dl></AdministrationPanel>
    <AdministrationPanel className="space-y-3"><h2 className="text-lg font-black text-[var(--kt-ink-navy)]">Safe evidence</h2><p>{item.summary}</p>{item.eventReference && <p>Webhook: <Link className="font-mono text-[var(--kt-signal-cobalt)]" href={`/admin/payment-webhooks/${item.eventReference}`}>{item.eventReference}</Link></p>}{item.safeEvidence ? <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(item.safeEvidence).map(([key, value]) => <div key={key}><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">{confirmationStatusLabel(key)}</dt><dd>{String(value ?? "—")}</dd></div>)}</dl> : <p className="text-[var(--kt-text-muted)]">No additional safe evidence is available.</p>}{item.resolutionCode && <p>Resolution: {confirmationStatusLabel(item.resolutionCode)}</p>}</AdministrationPanel>
  </div>;
}
