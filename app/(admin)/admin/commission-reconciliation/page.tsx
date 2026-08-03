import Link from "next/link";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listCommissionReconciliation } from "@/lib/services/commission-query.service";

export default async function CommissionReconciliationPage() {
  await requireAdminPagePermission(PERMISSIONS.COMMISSION_RECONCILIATION_READ); const cases = await listCommissionReconciliation({ page: 1, pageSize: 50 });
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Finance administration" title="Commission Reconciliation" description="Read-only exception evidence. Canonical reversal is the only available financial correction path." /><AdministrationPanel>{cases.data.length ? <table className="w-full text-left text-sm" aria-label="commission-reconciliation-table"><thead><tr><th>Case</th><th>Accrual</th><th>Amount</th><th>Reason</th><th>Status</th><th>Priority</th></tr></thead><tbody>{cases.data.map((record) => <tr key={record.publicReference}><td><Link href={`/admin/commission-reconciliation/${record.publicReference}`}>{record.publicReference}</Link></td><td>{record.accrualReference}</td><td>R {record.totalAmount}</td><td>{record.reason}</td><td>{record.status}</td><td>{record.priority}</td></tr>)}</tbody></table> : <p role="status">No commission reconciliation cases are available.</p>}</AdministrationPanel></div>;
}
