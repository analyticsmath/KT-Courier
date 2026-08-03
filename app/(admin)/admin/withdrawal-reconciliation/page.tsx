import Link from "next/link";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listWithdrawalReconciliation } from "@/lib/services/withdrawal-query.service";

export default async function WithdrawalReconciliationPage() {
  await requireAdminPagePermission(PERMISSIONS.WITHDRAWALS_RECONCILE); const cases = await listWithdrawalReconciliation({ page: 1, pageSize: 50 });
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Finance administration" title="Withdrawal Reconciliation" description="Read-only investigation evidence. There is no generic mark-paid control." /><AdministrationPanel>{cases.data.length ? <table className="w-full text-left text-sm" aria-label="withdrawal-reconciliation-table"><thead><tr><th>Case</th><th>Withdrawal</th><th>Reason</th><th>Status</th><th>Priority</th></tr></thead><tbody>{cases.data.map((caseRow) => <tr key={caseRow.publicReference}><td><Link href={`/admin/withdrawal-reconciliation/${caseRow.publicReference}`}>{caseRow.publicReference}</Link></td><td>{caseRow.withdrawalReference}</td><td>{caseRow.reason}</td><td>{caseRow.status}</td><td>{caseRow.priority}</td></tr>)}</tbody></table> : <p role="status">No reconciliation cases are open.</p>}</AdministrationPanel></div>;
}
