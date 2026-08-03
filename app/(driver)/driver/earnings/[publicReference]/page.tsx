import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { requireRole } from "@/lib/auth/guards";
import { getDriverEarningForOwner } from "@/lib/services/driver-earning-query.service";
import { UserRole } from "@/types/db";
import styles from "@/components/protected-v2/driver/driver-pages.module.css";

export const metadata: Metadata = { title: "Earning record" };

export default async function DriverEarningDetailPage({ params }: { params: Promise<{ publicReference: string }> }) {
  const user = await requireRole(UserRole.DRIVER);
  const { publicReference } = await params;
  const earning = await getDriverEarningForOwner(user.id, publicReference);
  if (!earning) notFound();
  return <div className={styles.scope}><ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Driver earnings" title={earning.publicReference} description="A source-backed earning record. Financial execution is not available from this view." actions={<Link className="eo-driver-button eo-driver-button--secondary" href="/driver/earnings">All earnings</Link>} />
    <ProtectedContentGrid contextRail={<OperationalPanel title="Current state" padding="compact"><ProtectedStatus label={earning.status.replaceAll("_", " ")} tone="neutral" /><p className="mt-3 text-sm text-[var(--eo-text-secondary)]">Existing production controls continue to govern financial execution. This screen does not reveal internal lock evidence or create a withdrawal action.</p></OperationalPanel>}><div className="space-y-6"><div className="eo-driver-detail-grid"><OperationalPanel title="Amounts" padding="compact"><ul className="eo-driver-context-list"><li>Original earning <strong className="float-right">ZAR {earning.originalEarningAmount}</strong></li><li>Available payable <strong className="float-right">ZAR {earning.availablePayableAmount}</strong></li><li>Released <strong className="float-right">ZAR {earning.releasedAmount}</strong></li><li>Refund reserved <strong className="float-right">ZAR {earning.refundReservedAmount}</strong></li></ul></OperationalPanel><OperationalPanel title="Record context" padding="compact"><ul className="eo-driver-context-list"><li>Assignment: {earning.assignmentPublicReference}</li><li>Order: {earning.orderPublicReference}</li><li>Service completed: {earning.serviceCompletedAt}</li><li>Release eligibility: {earning.releaseEligibleAt ?? "Not established"}</li></ul></OperationalPanel></div><OperationalPanel title="History" description="Source-issued state history." padding="compact"><ol className="eo-driver-context-list">{earning.history.map((event, index) => <li key={`${event.createdAt}-${index}`}><strong>{event.status.replaceAll("_", " ")}</strong><span className="block mt-1">{event.reasonCode ?? "No reason code"} · {event.createdAt}</span></li>)}</ol></OperationalPanel></div></ProtectedContentGrid>
  </ProtectedPageFrame></div>;
}
