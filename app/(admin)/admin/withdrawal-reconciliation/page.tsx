import Link from "next/link";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listWithdrawalReconciliation } from "@/lib/services/withdrawal-query.service";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { presentR21Status } from "@/lib/admin-presentation/r21-status";

export default async function WithdrawalReconciliationPage() {
  await requireAdminPagePermission(PERMISSIONS.WITHDRAWALS_RECONCILE); const cases = await listWithdrawalReconciliation({ page: 1, pageSize: 50 });
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Finance administration" title="Withdrawal Reconciliation" description="Read-only investigation evidence. There is no generic mark-paid control." /><AdministrationPanel><EditorialTable caption="Withdrawal reconciliation records" mobileMode="stack" rows={cases.data.map(row => ({ ...row, id: row.publicReference }))} emptyState={<p role="status">No reconciliation cases are open.</p>} columns={[
    { id: "case", header: "Case", cell: row => <Link className="eo-table-link" href={`/admin/withdrawal-reconciliation/${row.publicReference}`}>{row.publicReference}</Link> },
    { id: "withdrawal", header: "Withdrawal", cell: row => row.withdrawalReference },
    { id: "reason", header: "Reason", cell: row => row.reason },
    { id: "status", header: "Status", cell: row => <ProtectedStatus {...presentR21Status(row.status)} /> },
    { id: "priority", header: "Priority", cell: row => row.priority },
  ]} /></AdministrationPanel></div>;
}
