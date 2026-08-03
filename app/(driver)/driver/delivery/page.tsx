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
import { getDeliveryAssignments, getDeliveryWorkbenchSummary } from "@/lib/services/delivery-execution.service";
import { UserRole } from "@/types/db";
import styles from "@/components/protected-v2/driver/driver-pages.module.css";

export const metadata: Metadata = { title: "Active delivery" };

export default async function DriverDeliveryPage() {
  const user = await requireRole(UserRole.DRIVER);
  const [driver, driverProfileId] = await Promise.all([getDriverProfileByUserId(user.id), getDriverProfileIdForUser(user.id)]);
  if (!driver || !driverProfileId) return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Driver operations" title="Active delivery" /><ProtectedState kind="restricted" title="Driver profile unavailable" description="A linked driver profile is required to load delivery work." /></ProtectedPageFrame>;
  const active = driver.status === "ACTIVE";
  const [assignments, summary] = await Promise.all([active ? getDeliveryAssignments(driverProfileId) : Promise.resolve([]), active ? getDeliveryWorkbenchSummary(driverProfileId) : Promise.resolve({ deliveryReadyCount: 0, inTransitCount: 0, deliveryAttemptedCount: 0 })]);
  return <div className={styles.scope}><ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Driver operations" title="Active delivery" description="Delivery-stage records and their next canonical action." actions={<Link className="eo-driver-button eo-driver-button--secondary" href="/driver/workbench">Pickup workbench</Link>} />
    {!active ? <ProtectedState kind="restricted" title="Delivery work unavailable" description="Delivery actions require an active driver account. Account and order eligibility remain server-authoritative." illustration={<RouteQueueIllustration className="h-24 w-32" />} /> : <div className="space-y-6">
      <div className="eo-driver-metric-grid" aria-label="Delivery work summary"><MetricTile label="Ready to start" value={summary.deliveryReadyCount} description="Picked up records" /><MetricTile label="In transit" value={summary.inTransitCount} description="Current delivery-stage records" /><MetricTile label="Attempted" value={summary.deliveryAttemptedCount} description="Records with a canonical attempt" /></div>
      <OperationalPanel title="Delivery assignments" description="Open a record for OTP, delivery completion, attempt, or failure actions when the server permits them." padding="compact">{!assignments.length ? <ProtectedState kind="empty" title="No active deliveries" description="Delivery work appears here after an owned assignment has completed its pickup stage." illustration={<RouteQueueIllustration className="h-24 w-32" />} /> : <ol className="eo-driver-record-list" aria-label="Active delivery assignments">{assignments.map((assignment) => <li className="eo-driver-record" key={assignment.id}><Link className="eo-driver-record__link" href={`/driver/assignments/${assignment.id}`}><div className="eo-driver-record__header"><div><p className="eo-driver-record__reference">{assignment.orderNumber}</p><p className="eo-driver-record__route">{assignment.pickupCity ?? "Pickup"} → {assignment.dropoffCity ?? "Destination"}</p></div><ProtectedStatus label={assignment.assignmentStatusLabel} tone="information" /></div><p className="eo-driver-record__facts"><span>Current stage: {assignment.orderStatus.replaceAll("_", " ")}</span><span>{assignment.parcelCount} parcel{assignment.parcelCount === 1 ? "" : "s"}</span></p></Link></li>)}</ol>}</OperationalPanel>
      <OperationalPanel title="Location, navigation, and proof" padding="compact"><p className="text-sm text-[var(--eo-text-secondary)]">The driver delivery contract does not provide a map, live location, navigation link, camera, or proof-file upload control. Delivery completion stays on the canonical assignment route and waits for OTP and server confirmation.</p></OperationalPanel>
    </div>}
  </ProtectedPageFrame></div>;
}
