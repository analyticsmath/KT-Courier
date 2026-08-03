import Link from "next/link";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requireRefundPagePermission } from "@/lib/refunds/page-permission";
import { listRefundReconciliation } from "@/lib/services/refund-query.service";

export default async function RefundReconciliationPage() {
  await requireRefundPagePermission(PERMISSIONS.REFUNDS_RECONCILE); const cases = await listRefundReconciliation({ page: 1, pageSize: 50 });
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Finance controls" title="Refund Reconciliation" description="Monitor unknown provider outcomes and refund-to-ledger mismatches without a manual mark-success bypass." /><AdministrationPanel>{cases.data.length ? <table className="w-full text-left text-sm" aria-label="refund-reconciliation-table"><thead><tr><th>Case</th><th>Refund</th><th>Amount</th><th>Reason</th><th>Status</th><th>Priority</th><th>Observed</th></tr></thead><tbody>{cases.data.map((item) => <tr key={item.publicReference}><td><Link href={`/admin/refund-reconciliation/${item.publicReference}`}>{item.publicReference}</Link></td><td>{item.refundReference}</td><td>R {item.amount}</td><td>{item.reason}</td><td>{item.status}</td><td>{item.priority}</td><td>{item.observationCount}</td></tr>)}</tbody></table> : <p role="status">No refund reconciliation cases are open.</p>}</AdministrationPanel></div>;
}

