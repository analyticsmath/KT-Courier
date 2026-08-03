import type { Metadata } from "next";
import Link from "next/link";
import { MetricTile, OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { RouteQueueIllustration } from "@/components/protected-v2/illustrations/RouteQueueIllustration";
import { requireRole } from "@/lib/auth/guards";
import { getDriverProfileByUserId } from "@/lib/services/driver-profile.service";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { getDriverWorkbench, getWorkbenchAssignments, getWorkbenchSummary } from "@/lib/services/driver-workbench.service";
import { UserRole } from "@/types/db";
import styles from "@/components/protected-v2/driver/driver-pages.module.css";

export const metadata: Metadata = { title: "Pickup workbench" };

export default async function DriverWorkbenchPage() {
  const user = await requireRole(UserRole.DRIVER);
  const [driver, driverProfileId] = await Promise.all([getDriverProfileByUserId(user.id), getDriverProfileIdForUser(user.id)]);
  if (!driver || !driverProfileId) return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Driver operations" title="Pickup workbench" /><ProtectedState kind="restricted" title="Driver profile unavailable" description="A linked driver profile is required to load pickup work." /></ProtectedPageFrame>;

  const active = driver.status === "ACTIVE";
  const [assignments, summary, workbench] = await Promise.all([
    active ? getWorkbenchAssignments(driverProfileId) : Promise.resolve([]),
    active ? getWorkbenchSummary(driverProfileId) : Promise.resolve({ acceptedCount: 0, pickupReadyCount: 0, pickupInProgressCount: 0 }),
    active ? getDriverWorkbench(driverProfileId) : Promise.resolve(null),
  ]);

  return <div className={styles.scope}><ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Driver operations" title="Pickup workbench" description="Accepted records that are currently eligible for a pickup-stage action." actions={<Link className="eo-driver-button eo-driver-button--secondary" href="/driver/assignments">All assignments</Link>} />
    {!active ? <ProtectedState kind="restricted" title="Pickup workbench unavailable" description="Pickup actions require an active driver account. This page does not override account or assignment eligibility." illustration={<RouteQueueIllustration className="h-24 w-32" />} /> : <div className="space-y-6">
      <div className="eo-driver-metric-grid" aria-label="Pickup work summary"><MetricTile label="Accepted" value={summary.acceptedCount} description="Current accepted assignments" /><MetricTile label="Pickup ready" value={summary.pickupReadyCount} description="Eligible pickup-stage records" /><MetricTile label="Pickup in progress" value={summary.pickupInProgressCount} description="Source event recorded" /></div>
      {workbench?.activeAssignment ? <OperationalPanel title="Current operation" description="The server determines action eligibility. Open the record to take an allowed action." padding="compact"><div className="eo-driver-record__header"><div><p className="eo-driver-record__reference">{workbench.activeAssignment.orderNumber}</p><p className="eo-driver-record__route">Current stage: {workbench.activeAssignment.orderStatus.replaceAll("_", " ")}</p></div><ProtectedStatus label={workbench.activeAssignment.actions.blockedReasons.length ? "Action constrained" : "Current record"} tone={workbench.activeAssignment.actions.blockedReasons.length ? "warning" : "information"} /></div><div className="eo-driver-next-action"><p><strong>Operational actions</strong>Only canonical pickup and delivery actions appear on the assignment detail route.</p><Link className="eo-driver-button eo-driver-button--primary" href={`/driver/assignments/${workbench.activeAssignment.assignmentId}`}>Open current assignment</Link></div></OperationalPanel> : null}
      <OperationalPanel title="Pickup-ready assignments" description="No distance, route, ETA, location tracking, or navigation data is generated here." padding="compact">{!assignments.length ? <ProtectedState kind="empty" title="No pickup-ready assignments" description="Accepted work appears only after the canonical order status becomes pickup eligible." illustration={<RouteQueueIllustration className="h-24 w-32" />} /> : <ol className="eo-driver-record-list" aria-label="Pickup-ready assignments">{assignments.map((assignment) => <li className="eo-driver-record" key={assignment.id}><Link className="eo-driver-record__link" href={`/driver/assignments/${assignment.id}`}><div className="eo-driver-record__header"><div><p className="eo-driver-record__reference">{assignment.orderNumber}</p><p className="eo-driver-record__route">{assignment.pickupCity ?? "Pickup details in assignment"}</p></div><ProtectedStatus label={assignment.pickupStarted ? "Pickup in progress" : assignment.assignmentStatusLabel} tone={assignment.pickupStarted ? "information" : "neutral"} /></div><p className="eo-driver-record__facts"><span>{assignment.parcelCount} parcel{assignment.parcelCount === 1 ? "" : "s"}</span><span>Order status: {assignment.orderStatus.replaceAll("_", " ")}</span></p></Link></li>)}</ol>}</OperationalPanel>
      <OperationalPanel title="Location and navigation" padding="compact"><p className="text-sm text-[var(--eo-text-secondary)]">This route has no driver map, external-navigation, geolocation, or provider-status authority. It intentionally does not simulate a route or location state.</p></OperationalPanel>
    </div>}
  </ProtectedPageFrame></div>;
}
