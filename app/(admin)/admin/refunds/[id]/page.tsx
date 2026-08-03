import { notFound } from "next/navigation";
import { FinanceRefundActions } from "@/components/refunds/FinanceRefundActions";
import { ActivityTimeline } from "@/components/protected-v2/feedback/ActivityTimeline";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { hasRefundPagePermission, requireRefundPagePermission } from "@/lib/refunds/page-permission";
import { REFUND_PRODUCTION_READINESS } from "@/lib/refunds/refund-production-readiness";
import { getFinanceRefund } from "@/lib/services/refund-query.service";
import { presentR21Status } from "@/lib/admin-presentation/r21-status";

export default async function FinanceRefundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRefundPagePermission(PERMISSIONS.REFUNDS_READ); const { id } = await params; const refund = await getFinanceRefund(id); if (!refund) notFound();
  const actor = { id: user.id, role: user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN" } as const;
  const [canReview, canApprove, canProcess, canReconcile, canReadProviderStatus] = await Promise.all([hasRefundPagePermission(actor, PERMISSIONS.REFUNDS_REVIEW), hasRefundPagePermission(actor, PERMISSIONS.REFUNDS_APPROVE), hasRefundPagePermission(actor, PERMISSIONS.REFUNDS_PROCESS), hasRefundPagePermission(actor, PERMISSIONS.REFUNDS_RECONCILE), hasRefundPagePermission(actor, PERMISSIONS.REFUND_PROVIDER_STATUS_READ)]);
  const status = presentR21Status(refund.status);
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Finance refund" title="Refund" description={refund.publicReference} actions={<ProtectedStatus {...status} />} />
    <OperationalPanel title="Canonical refund evidence" description="Customer contact and internal actor identifiers are deliberately withheld from this finance projection."><dl className="eo-detail-grid"><div><dt>Amount</dt><dd className="font-mono">R {refund.amount} ZAR</dd></div><div><dt>Status</dt><dd><ProtectedStatus {...status} /></dd></div><div><dt>Remaining refundable</dt><dd className="font-mono">R {refund.remainingRefundableAmount}</dd></div><div><dt>Payment / order</dt><dd>{refund.paymentReference}<small>{refund.orderReference}</small></dd></div><div><dt>Customer</dt><dd>{refund.customer.name}</dd></div><div><dt>Method / reason</dt><dd>{refund.method}<small>{refund.reasonCode}</small></dd></div><div><dt>Reserve journal</dt><dd>{refund.journals.reserve}</dd></div><div><dt>Release journal</dt><dd>{refund.journals.release ?? "—"}</dd></div><div><dt>Completion journal</dt><dd>{refund.journals.completion ?? "—"}</dd></div></dl></OperationalPanel>
    <OperationalPanel title="Refund funding" description="Safe financial references only; no account internals are exposed."><table className="eo-table" aria-label="Refund funding"><thead><tr><th>Source</th><th>Account purpose</th><th>Amount</th><th>Commission evidence</th></tr></thead><tbody>{refund.fundingAllocations.map((item) => <tr key={item.publicReference}><td>{item.sourceType}</td><td>{item.account.purpose}</td><td className="font-mono">R {item.amount}</td><td>{item.commissionAllocation?.publicReference ?? "Customer funds held"}</td></tr>)}</tbody></table></OperationalPanel>
    {canReview || canApprove || canProcess || (canReconcile && canReadProviderStatus) ? <OperationalPanel title="Canonical controls" description="Eligibility is resolved on the server. Completion remains unavailable while the existing production lock is active."><FinanceRefundActions id={refund.id} status={refund.status} method={refund.method} canReview={canReview} canApprove={canApprove} canProcess={canProcess} canReconcile={canReconcile && canReadProviderStatus} completionLocked={!REFUND_PRODUCTION_READINESS.productionValidationApproved} /></OperationalPanel> : null}
    <OperationalPanel title="Execution attempts" description="Safe provider-attempt metadata; unknown outcomes require reconciliation.">{refund.attempts.length ? <ul className="space-y-2">{refund.attempts.map((attempt) => <li key={attempt.publicReference}>{attempt.publicReference} — {attempt.provider} — <ProtectedStatus {...presentR21Status(attempt.status)} /> — {attempt.failureCode ?? "No safe failure code"}</li>)}</ul> : <p role="status">No provider attempts.</p>}</OperationalPanel>
    <OperationalPanel title="Immutable history" description="Chronological canonical refund events."><ActivityTimeline ariaLabel="Refund history" items={refund.history.map((event, index) => ({ id: `${event.createdAt}-${index}`, title: presentR21Status(event.toStatus).label, description: event.reasonCode, timestamp: new Date(event.createdAt).toLocaleString(), tone: presentR21Status(event.toStatus).tone }))} /></OperationalPanel>
  </ProtectedPageFrame>;
}
