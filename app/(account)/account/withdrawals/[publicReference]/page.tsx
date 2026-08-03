import { notFound } from "next/navigation";
import { ActivityTimeline, OperationalPanel, ProtectedStatus } from "@/components/protected-v2";
import { CustomerAction, CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { formatCustomerDateTime, formatCustomerMoney, getCustomerWithdrawalStatus } from "@/lib/customer-presentation/customer-order-presentation";
import { CancelWithdrawalButton } from "@/components/withdrawals/CancelWithdrawalButton";
import { requireAuth } from "@/lib/auth/guards";
import { getOwnerWithdrawal } from "@/lib/services/withdrawal-query.service";

export default async function WithdrawalDetailPage({ params }: { params: Promise<{ publicReference: string }> }) {
  const user = await requireAuth();
  const { publicReference } = await params;
  const withdrawal = await getOwnerWithdrawal(user.id, publicReference);
  if (!withdrawal) notFound();
  const status = getCustomerWithdrawalStatus(withdrawal.status);
  return <CustomerPage eyebrow="Withdrawal request" title={withdrawal.publicReference} description="Customer-safe withdrawal request details." actions={<CustomerAction href="/account/withdrawals">Back to withdrawals</CustomerAction>}><OperationalPanel title="Current status"><ProtectedStatus label={status.label} tone={status.tone} /><dl className="mt-5 grid gap-4 sm:grid-cols-2 text-sm"><div><dt className="text-[var(--eo-text-muted)]">Amount</dt><dd className="mt-1 font-semibold tabular-nums">{formatCustomerMoney(withdrawal.amount, "ZAR")}</dd></div><div><dt className="text-[var(--eo-text-muted)]">Destination</dt><dd className="mt-1">{withdrawal.destination.maskedLabel}</dd></div></dl>{withdrawal.canCancel ? <div className="mt-5"><CancelWithdrawalButton publicReference={withdrawal.publicReference} /></div> : null}</OperationalPanel><OperationalPanel title="Status history"><ActivityTimeline ariaLabel="Withdrawal request history" items={withdrawal.history.map((event, index) => { const eventStatus = getCustomerWithdrawalStatus(event.toStatus); return { id: `${event.createdAt}-${index}`, title: eventStatus.label, timestamp: formatCustomerDateTime(event.createdAt) ?? undefined, tone: eventStatus.tone }; })} /></OperationalPanel></CustomerPage>;
}
