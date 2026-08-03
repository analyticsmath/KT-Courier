import { notFound } from "next/navigation";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getStoreEarningReconciliation } from "@/lib/services/store-earning-query.service";
import { requireStoreEarningFinancePagePermission } from "@/lib/store-earnings/finance-permission";

export default async function StoreEarningReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStoreEarningFinancePagePermission(PERMISSIONS.STORE_EARNINGS_RECONCILE); const record = await getStoreEarningReconciliation((await params).id); if (!record) notFound();
  return <div className="max-w-5xl space-y-6"><ProtectedPageHeader eyebrow="Finance exception evidence" title="Store Earning Reconciliation" description={`${record.publicReference} — ${record.status}`} /><AdministrationPanel><dl><dt>Earning</dt><dd>{record.earning.publicReference}</dd><dt>Store</dt><dd>{record.earning.storePublicReference}</dd><dt>Amount</dt><dd>R {record.earning.amount}</dd><dt>Reason</dt><dd>{record.reason}</dd><dt>Priority</dt><dd>{record.priority}</dd><dt>Summary</dt><dd>{record.safeSummary}</dd><dt>Refund</dt><dd>{record.refund?.publicReference ?? "None"}</dd><dt>Commission accrual</dt><dd>{record.commissionAccrual?.publicReference ?? "None"}</dd><dt>Last observed</dt><dd>{record.lastObservedAt}</dd><dt>Resolution</dt><dd>{record.resolutionCode ?? "Open"}</dd></dl></AdministrationPanel><AdministrationPanel><h2 className="text-lg font-semibold">Safe evidence</h2><p role="status">Safe evidence is recorded under restricted finance authority and is not rendered as a raw payload.</p></AdministrationPanel></div>;
}
