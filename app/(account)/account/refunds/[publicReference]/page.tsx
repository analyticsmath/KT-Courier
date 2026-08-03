import { notFound } from "next/navigation";
import { ActivityTimeline, OperationalPanel, ProtectedStatus } from "@/components/protected-v2";
import { CustomerAction, CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { formatCustomerDateTime, formatCustomerMoney, getCustomerRefundReason, getCustomerRefundStatus } from "@/lib/customer-presentation/customer-order-presentation";
import { CancelRefundButton } from "@/components/refunds/CancelRefundButton";
import { requireAuth } from "@/lib/auth/guards";
import { getCustomerRefund } from "@/lib/services/refund-query.service";

export default async function CustomerRefundDetailPage({ params }: { params: Promise<{ publicReference: string }> }) {
  const user = await requireAuth();
  const { publicReference } = await params;
  const refund = await getCustomerRefund(user.id, publicReference);
  if (!refund) notFound();
  const status = getCustomerRefundStatus(refund.status);
  return (
    <CustomerPage eyebrow="Refund request" title={refund.publicReference} description="Customer-safe refund request details." actions={<CustomerAction href="/account/refunds">Back to refunds</CustomerAction>}>
      <OperationalPanel title="Refund status"><ProtectedStatus label={status.label} tone={status.tone} /><dl className="mt-5 grid gap-4 sm:grid-cols-2 text-sm"><div><dt className="text-[var(--eo-text-muted)]">Amount</dt><dd className="mt-1 font-semibold tabular-nums">{formatCustomerMoney(refund.amount, refund.currency)}</dd></div><div><dt className="text-[var(--eo-text-muted)]">Method</dt><dd className="mt-1">{refund.method === "CUSTOMER_WALLET" ? "Customer wallet" : "Original payment method"}</dd></div><div><dt className="text-[var(--eo-text-muted)]">Payment reference</dt><dd className="mt-1 font-mono">{refund.paymentReference}</dd></div><div><dt className="text-[var(--eo-text-muted)]">Order reference</dt><dd className="mt-1 font-mono">{refund.orderReference}</dd></div><div><dt className="text-[var(--eo-text-muted)]">Reason</dt><dd className="mt-1">{getCustomerRefundReason(refund.reasonCode)}</dd></div></dl>{refund.customerNote ? <p className="mt-5 text-sm leading-6 text-[var(--eo-text-secondary)]">Your note: {refund.customerNote}</p> : null}{refund.canCancel ? <div className="mt-5"><CancelRefundButton publicReference={refund.publicReference} /></div> : null}</OperationalPanel>
      <OperationalPanel title="Progress"><ActivityTimeline ariaLabel="Refund request progress" items={refund.progress.map((event, index) => { const eventStatus = getCustomerRefundStatus(event.status); return { id: `${event.createdAt}-${index}`, title: eventStatus.label, description: getCustomerRefundReason(event.reasonCode), timestamp: formatCustomerDateTime(event.createdAt) ?? undefined, tone: eventStatus.tone }; })} /></OperationalPanel>
      {refund.productionLock.active ? <OperationalPanel title="Production state"><p className="text-sm leading-6 text-[var(--eo-text-secondary)]">Refund execution remains inactive until consolidated production validation is approved. Reserved funds remain protected from duplicate processing.</p></OperationalPanel> : null}
    </CustomerPage>
  );
}
