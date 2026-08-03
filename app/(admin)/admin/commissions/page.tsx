import Link from "next/link";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listCommissions } from "@/lib/services/commission-query.service";

export default async function CommissionsPage() {
  await requireAdminPagePermission(PERMISSIONS.COMMISSIONS_READ); const commissions = await listCommissions({ page: 1, pageSize: 50 });
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Finance administration" title="Commissions" description="Read-only commission accrual, allocation, journal, and reconciliation evidence." /><AdministrationPanel>{commissions.data.length ? <table className="w-full text-left text-sm" aria-label="commissions-table"><thead><tr><th>Reference</th><th>Subject</th><th>Plan</th><th>Amount</th><th>Status</th><th>Reconciliation</th></tr></thead><tbody>{commissions.data.map((commission) => <tr key={commission.id}><td><Link href={`/admin/commissions/${commission.id}`}>{commission.publicReference}</Link></td><td>{commission.subjectPublicReference}</td><td>{commission.planReference} v{commission.planVersionNumber}</td><td>R {commission.totalAmount}</td><td>{commission.status}</td><td>{commission.reconciliationRequired ? "Required" : "Clear"}</td></tr>)}</tbody></table> : <p role="status">No commission accruals are available.</p>}</AdministrationPanel></div>;
}
