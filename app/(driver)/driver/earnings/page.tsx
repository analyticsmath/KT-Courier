import type { Metadata } from "next";
import Link from "next/link";
import { MetricTile, OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { SecureLedgerIllustration } from "@/components/protected-v2/illustrations/SecureLedgerIllustration";
import { requireRole } from "@/lib/auth/guards";
import { listDriverEarningsForOwner } from "@/lib/services/driver-earning-query.service";
import { getDriverEarningSummaryForOwner } from "@/lib/services/driver-earning-summary.service";
import type { DriverEarningListItemDto } from "@/lib/dto/driver-earning.dto";
import { UserRole } from "@/types/db";
import styles from "@/components/protected-v2/driver/driver-pages.module.css";

export const metadata: Metadata = { title: "Driver earnings" };

export default async function DriverEarningsPage() {
  const user = await requireRole(UserRole.DRIVER);
  const [summary, earnings] = await Promise.all([getDriverEarningSummaryForOwner(user.id), listDriverEarningsForOwner(user.id, { page: 1, pageSize: 50 })]);
  return <div className={styles.scope}><ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Driver account" title="Earnings" description="Server-authoritative earning records and financial state. Amounts are displayed exactly as issued by the earning services." />
    <div className="space-y-6"><div className="eo-driver-metric-grid" aria-label="Driver earnings summary"><MetricTile label="Payable balance" value={`ZAR ${summary.payableBalance}`} description="Current source-backed balance" /><MetricTile label="Released" value={`ZAR ${summary.releasedToOwnerWithdrawable}`} description="Released to the owner balance" /><MetricTile label="Refund reserved" value={`ZAR ${summary.refundReserved}`} description="Reserved amount in the source projection" /></div>
      <OperationalPanel title="Earning records" description="Financial execution and withdrawals are not exposed on this driver route while their existing production controls remain incomplete." padding="compact">{!earnings.data.length ? <ProtectedState kind="empty" title="No earning records" description="A record appears here only after the canonical earning service creates it." illustration={<SecureLedgerIllustration className="h-24 w-32" />} /> : <ol className="eo-driver-record-list" aria-label="Driver earning records">{earnings.data.map((earning: DriverEarningListItemDto) => <li key={earning.publicReference} className="eo-driver-record"><Link className="eo-driver-record__link" href={`/driver/earnings/${earning.publicReference}`}><div className="eo-driver-record__header"><div><p className="eo-driver-record__reference">{earning.publicReference}</p><p className="eo-driver-record__route">Assignment {earning.assignmentPublicReference}</p></div><ProtectedStatus label={earning.status.replaceAll("_", " ")} tone="neutral" /></div><p className="eo-driver-record__facts"><span>Available: ZAR {earning.availablePayableAmount}</span><span>Service completed: {earning.serviceCompletedAt}</span></p></Link></li>)}</ol>}</OperationalPanel>
    </div>
  </ProtectedPageFrame></div>;
}
