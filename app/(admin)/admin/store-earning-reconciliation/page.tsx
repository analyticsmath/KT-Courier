import Link from "next/link";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listStoreEarningReconciliation } from "@/lib/services/store-earning-query.service";
import { requireStoreEarningFinancePagePermission } from "@/lib/store-earnings/finance-permission";

export default async function StoreEarningReconciliationPage() {
  await requireStoreEarningFinancePagePermission(PERMISSIONS.STORE_EARNINGS_RECONCILE); const cases = await listStoreEarningReconciliation({ page: 1, pageSize: 50 });
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Finance administration" title="Store Earning Reconciliation" description="Read-only exception evidence. Resolution is possible only through canonical financial operations." /><AdministrationPanel>{cases.data.length ? <table className="w-full text-left text-sm"><thead><tr><th>Case</th><th>Earning</th><th>Store</th><th>Reason</th><th>Priority</th><th>Status</th><th>Observed</th></tr></thead><tbody>{cases.data.map((record) => <tr key={record.publicReference}><td><Link href={`/admin/store-earning-reconciliation/${record.publicReference}`}>{record.publicReference}</Link></td><td>{record.earningReference}</td><td>{record.storePublicReference}</td><td>{record.reason}</td><td>{record.priority}</td><td>{record.status}</td><td>{record.observationCount}</td></tr>)}</tbody></table> : <p role="status">No store earning reconciliation cases are available.</p>}</AdministrationPanel></div>;
}
