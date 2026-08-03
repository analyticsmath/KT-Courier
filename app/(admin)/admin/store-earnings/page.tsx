import Link from "next/link";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listFinanceStoreEarnings } from "@/lib/services/store-earning-query.service";
import { requireStoreEarningFinancePagePermission } from "@/lib/store-earnings/finance-permission";

export default async function AdminStoreEarningsPage() {
  await requireStoreEarningFinancePagePermission(PERMISSIONS.STORE_EARNINGS_READ); const earnings = await listFinanceStoreEarnings({ page: 1, pageSize: 50 });
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Finance administration" title="Store Earnings" description="Read-only store settlement, commission attribution, refund and ledger evidence." /><AdministrationPanel>{earnings.data.length ? <table className="w-full text-left text-sm" aria-label="admin-store-earnings-table"><thead><tr><th>Reference</th><th>Store</th><th>Subject</th><th>Basis</th><th>Commission</th><th>Net</th><th>Available</th><th>Status</th></tr></thead><tbody>{earnings.data.map((earning) => <tr key={earning.id}><td><Link href={`/admin/store-earnings/${earning.id}`}>{earning.publicReference}</Link></td><td>{earning.storePublicReference}</td><td>{earning.subjectPublicReference}</td><td>R {earning.settlementBasisAmount}</td><td>R {earning.attributedCommissionAmount}</td><td>R {earning.originalEarningAmount}</td><td>R {earning.availablePayableAmount}</td><td>{earning.status}</td></tr>)}</tbody></table> : <p role="status">No store earnings are available.</p>}</AdministrationPanel></div>;
}
