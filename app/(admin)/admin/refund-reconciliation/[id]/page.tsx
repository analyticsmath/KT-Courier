import { notFound } from "next/navigation";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requireRefundPagePermission } from "@/lib/refunds/page-permission";
import { getRefundReconciliation } from "@/lib/services/refund-query.service";

export default async function RefundReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRefundPagePermission(PERMISSIONS.REFUNDS_RECONCILE); const { id } = await params; const item = await getRefundReconciliation(id); if (!item) notFound();
  return <div className="max-w-5xl space-y-6"><ProtectedPageHeader eyebrow="Finance controls" title="Refund Reconciliation" description={item.publicReference} /><AdministrationPanel><dl className="grid gap-3 sm:grid-cols-2"><div><dt>Refund</dt><dd>{item.refund.publicReference}</dd></div><div><dt>Amount</dt><dd>R {item.refund.amount} ZAR</dd></div><div><dt>Refund status</dt><dd>{item.refund.status}</dd></div><div><dt>Reason</dt><dd>{item.reason}</dd></div><div><dt>Case status</dt><dd>{item.status}</dd></div><div><dt>Priority</dt><dd>{item.priority}</dd></div><div><dt>Observation count</dt><dd>{item.observationCount}</dd></div><div><dt>Provider attempt</dt><dd>{item.attempt?.publicReference ?? "—"}</dd></div></dl><p className="mt-4 text-sm">{item.summary}</p></AdministrationPanel><AdministrationPanel><h2 className="text-lg font-semibold">Safe evidence</h2><p role="status">Safe evidence is recorded under restricted finance authority and is not rendered as a raw payload.</p><p className="mt-3 text-sm text-slate-600">There is no manual mark-success control. Verified provider success must pass through atomic finalization.</p></AdministrationPanel></div>;
}

