import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { confirmationStatusLabel, confirmationTimeLabel } from "@/components/admin/PaymentConfirmationTables";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPaymentWebhookDetail } from "@/lib/services/payment-confirmation-query.service";

export const metadata: Metadata = { title: "Payment webhook details" };

export default async function PaymentWebhookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.PAYMENT_WEBHOOKS_READ);
  const { id } = await params;
  const event = await getPaymentWebhookDetail(id);
  if (!event) notFound();
  const checks = [["Source address", event.verification.sourceAddress], ["Signature", event.verification.signature], ["Merchant", event.verification.merchant], ["Exact amount", event.verification.amount], ["Payfast confirmation", event.verification.providerConfirmation]] as const;
  return <div className="max-w-6xl space-y-6"><ProtectedPageHeader eyebrow="Provider evidence" title="Payment Webhooks" description={event.publicReference} />
    <AdministrationPanel><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Received</dt><dd>{confirmationTimeLabel(event.receivedAt)}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Environment</dt><dd>{event.environment}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Provider status</dt><dd>{confirmationStatusLabel(event.normalizedStatus)}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Processing</dt><dd>{confirmationStatusLabel(event.processingStatus)}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Payment</dt><dd className="font-mono text-xs">{event.paymentReference ?? "—"}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Attempt</dt><dd className="font-mono text-xs">{event.attemptReference ?? "—"}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Provider payment</dt><dd className="font-mono text-xs">{event.providerPaymentId ?? "—"}</dd></div><div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Gross amount</dt><dd className="font-mono">{event.amount ?? "—"}</dd></div></dl></AdministrationPanel>
    <AdministrationPanel className="space-y-4"><h2 className="text-lg font-black text-[var(--kt-ink-navy)]">Verification checklist</h2><ul className="grid gap-3 sm:grid-cols-2">{checks.map(([name, passed]) => <li key={name} className="flex items-center justify-between rounded-xl border border-[var(--kt-soft-border)] p-3"><span>{name}</span><strong>{passed ? "Verified" : "Not verified"}</strong></li>)}</ul>{event.rejectionCode && <p className="text-sm text-[var(--kt-text-muted)]">Safe rejection code: {event.rejectionCode}</p>}</AdministrationPanel>
    <AdministrationPanel className="space-y-3"><h2 className="text-lg font-black text-[var(--kt-ink-navy)]">Financial and reconciliation links</h2>{event.ledgerJournal ? <p>Ledger journal: <Link className="font-mono text-[var(--kt-signal-cobalt)]" href={`/admin/ledger/journals/${event.ledgerJournal.id}`}>{event.ledgerJournal.reference}</Link></p> : <p className="text-[var(--kt-text-muted)]">No receipt journal is linked.</p>}{event.reconciliationCases.length ? <ul>{event.reconciliationCases.map((entry) => <li key={entry.publicReference}><Link className="font-mono text-[var(--kt-signal-cobalt)]" href={`/admin/payment-reconciliation/${entry.publicReference}`}>{entry.publicReference}</Link> — {confirmationStatusLabel(entry.reason)} ({entry.status})</li>)}</ul> : <p className="text-[var(--kt-text-muted)]">No reconciliation case is linked.</p>}</AdministrationPanel>
  </div>;
}
