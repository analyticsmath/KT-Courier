import Link from "next/link";
import { redirect } from "next/navigation";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { MetricTile, OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { SecureLedgerIllustration } from "@/components/protected-v2/illustrations/SecureLedgerIllustration";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listStoreEarningsForOwner } from "@/lib/services/store-earning-query.service";
import { getStoreEarningSummaryForOwner } from "@/lib/services/store-earning-summary.service";

export default async function StoreEarningsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const [summary, earnings] = await Promise.all([getStoreEarningSummaryForOwner(user.id), listStoreEarningsForOwner(user.id, { page: 1, pageSize: 50 })]);
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Finance" title="Earnings" description="Server-authoritative store earning projections. Amounts are displayed with their explicit currency and do not calculate in the browser." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricTile label="Payable balance" value={`ZAR ${summary.payableBalance}`} description="Current payable ledger projection" /><MetricTile label="Released" value={`ZAR ${summary.releasedToWithdrawable}`} description="Released store earnings projection" /><MetricTile label="Refund reserved" value={`ZAR ${summary.refundReserved}`} description="Reserved against refunds" /><MetricTile label="Accrued" value={`ZAR ${summary.totalAccrued}`} description="Recorded store earning amount" /></div>
    <OperationalPanel title="Earning records" description="Financial actions are intentionally absent while the existing financial controls remain in effect." padding="compact">{earnings.data.length ? <EditorialTable caption="Store earning records" mobileMode="stack" rows={earnings.data.map((earning) => ({ id: earning.publicReference, earning }))} columns={[
      { id: "reference", header: "Earning", priority: "primary", cell: ({ earning }) => <Link className="font-mono font-semibold" href={`/store/earnings/${earning.publicReference}`}>{earning.publicReference}</Link> },
      { id: "original", header: "Original", align: "end", priority: "secondary", cell: ({ earning }) => `ZAR ${earning.originalEarningAmount}` },
      { id: "available", header: "Available payable", align: "end", priority: "secondary", cell: ({ earning }) => `ZAR ${earning.availablePayableAmount}` },
      { id: "status", header: "Status", priority: "optional", cell: ({ earning }) => <ProtectedStatus label={earning.status.replaceAll("_", " ")} /> },
    ]} /> : <ProtectedState kind="empty" title="No store earnings are available" description="Earning records will appear only when the existing settlement and earning authorities produce a store-owned projection." illustration={<SecureLedgerIllustration className="h-24 w-32" />} />}</OperationalPanel>
  </ProtectedPageFrame>;
}
