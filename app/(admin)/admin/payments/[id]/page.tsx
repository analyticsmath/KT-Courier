import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { PaymentAttemptsTable, PaymentHistoryTable } from "@/components/admin/PaymentTables";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { formatZarLedgerAmount } from "@/lib/ledger/format";
import { getPaymentDetail } from "@/lib/services/payment-query.service";
import { presentR21Status } from "@/lib/admin-presentation/r21-status";

export const metadata: Metadata = { title: "Payment details" };

export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.PAYMENTS_READ);
  const { id } = await params;
  const detail = await getPaymentDetail(id);
  if (!detail) notFound();
  const payment = detail.payment;
  const status = presentR21Status(payment.status);
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Provider lifecycle" title="Payment details" description={payment.publicReference} actions={<ProtectedStatus {...status} />} />
    <OperationalPanel title="Canonical payment evidence" description="The provider, amount, and history below are safe server-selected projections."><dl className="eo-detail-grid">
      <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Order reference</dt><dd className="mt-1">{payment.order.reference}</dd></div>
      <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Payer</dt><dd className="mt-1">{payment.payer.label}</dd></div>
      <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Amount</dt><dd className="mt-1 font-mono font-black">{formatZarLedgerAmount(payment.amount)} {payment.currency}</dd></div>
      <div><dt>Status</dt><dd><ProtectedStatus {...status} /></dd></div>
      <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Provider</dt><dd className="mt-1">{payment.provider ?? "Not selected"}</dd></div>
      <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Attempts</dt><dd className="mt-1">{payment.latestAttemptNumber}</dd></div>
      <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Created</dt><dd className="mt-1">{new Date(payment.createdAt).toLocaleString("en-ZA")}</dd></div>
      <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Version</dt><dd className="mt-1">{payment.version}</dd></div>
    </dl></OperationalPanel>
    <OperationalPanel title="Payment attempts" description="Ordered provider-operation records with normalized, safe outcomes."><PaymentAttemptsTable attempts={detail.attempts} /></OperationalPanel>
    <OperationalPanel title="Payment lifecycle history" description="Immutable aggregate state evidence."><PaymentHistoryTable history={detail.history} /></OperationalPanel>
  </ProtectedPageFrame>;
}
