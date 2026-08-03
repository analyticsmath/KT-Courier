import Link from "next/link";
import type { DriverAssignmentDto } from "@/lib/dto/assignment.dto";
import type { DriverSelfDto } from "@/lib/dto/driver.dto";
import { getDriverOperationalPresentation } from "@/lib/driver-presentation/driver-state";
import { prioritiseDriverAssignments } from "@/lib/driver-presentation/assignment-priority";
import { MetricTile, OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { RouteQueueIllustration } from "@/components/protected-v2/illustrations/RouteQueueIllustration";
import { DriverActiveRun } from "./DriverActiveRun";
import styles from "./driver-pages.module.css";

export function DriverHomePage({ driver, assignments }: { driver: DriverSelfDto; assignments: readonly DriverAssignmentDto[] }) {
  const ordered = prioritiseDriverAssignments(assignments);
  const state = getDriverOperationalPresentation({ status: driver.status, availability: driver.availability, assignments: ordered });
  const active = state.assignmentId ? ordered.find((assignment) => assignment.id === state.assignmentId) ?? null : null;
  const pendingOffers = ordered.filter((assignment) => assignment.status === "ASSIGNED");
  const currentWork = ordered.filter((assignment) => assignment.status === "ACCEPTED" && !["DELIVERED", "COMPLETED", "CANCELLED", "FAILED"].includes(assignment.orderStatus));
  const nextRecord = ordered.find((assignment) => assignment.id !== active?.id) ?? null;

  const accountContext = <div className="space-y-4"><OperationalPanel title="Driver status" padding="compact"><ProtectedStatus label={state.label} tone={state.tone} /><p className="mt-3 text-sm text-[var(--eo-text-secondary)]">{state.description}</p><Link className="eo-text-link mt-3 inline-flex" href="/driver/availability">Manage availability</Link></OperationalPanel><OperationalPanel title="Driver account" padding="compact"><ul className="eo-driver-context-list"><li>Vehicle: {driver.vehicleType ? driver.vehicleType.toLowerCase() : "Not assigned"}</li><li>Service regions: {driver.serviceRegions.length}</li><li>Profile state: {driver.onboardingStatus.replaceAll("_", " ").toLowerCase()}</li></ul><Link className="eo-text-link mt-3 inline-flex" href="/driver/profile">View profile and vehicle</Link></OperationalPanel></div>;

  return <div className={styles.scope}><ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Driver operations" title={driver.displayName ?? "Driver home"} description="Your current operational state and the next server-authoritative assignment action." actions={<Link className="eo-driver-button eo-driver-button--secondary" href="/driver/assignments">Assignments</Link>} />
    <ProtectedContentGrid contextRail={accountContext}>
      <div className="space-y-6">
        <div className="eo-driver-metric-grid" aria-label="Current driver work summary"><MetricTile label="Current assignments" value={currentWork.length} description="Accepted, non-terminal work" /><MetricTile label="Awaiting decision" value={pendingOffers.length} description="Dispatched offers requiring review" /></div>
        {active ? <DriverActiveRun assignment={active} /> : state.state === "ASSIGNMENT_DECISION_REQUIRED" && pendingOffers[0] ? <section className="eo-driver-active-run"><div className="eo-driver-active-run__header"><div><p className="eo-driver-record__reference">{pendingOffers[0].orderNumber}</p><h2>Assignment awaiting decision</h2><p className="eo-driver-meta">Review the record before choosing its canonical action.</p></div><ProtectedStatus label="Decision required" tone="warning" /></div><div className="eo-driver-next-action"><p><strong>Next action</strong>Review assignment</p><Link className="eo-driver-button eo-driver-button--primary" href={`/driver/assignments/${pendingOffers[0].id}`}>Review assignment</Link></div></section> : <ProtectedState kind={state.state === "ACCOUNT_SUSPENDED" || state.state === "ACCOUNT_ACTION_REQUIRED" ? "restricted" : "empty"} title={state.label} description={state.description} illustration={<RouteQueueIllustration className="h-24 w-32" />} action={state.state === "UNAVAILABLE" || state.state === "AVAILABLE_NO_ASSIGNMENT" ? <Link className="eo-driver-button eo-driver-button--secondary" href="/driver/availability">Manage availability</Link> : undefined} />}
        {nextRecord ? <OperationalPanel title="After current work" description="The next displayed record follows the documented operational ordering." padding="compact"><Link className="eo-driver-record__link eo-driver-record" href={`/driver/assignments/${nextRecord.id}`}><div className="eo-driver-record__header"><div><p className="eo-driver-record__reference">{nextRecord.orderNumber}</p><p className="eo-driver-record__route">{nextRecord.pickupCity ?? "Pickup"} → {nextRecord.dropoffCity ?? "Destination"}</p></div><ProtectedStatus label={nextRecord.statusLabel} tone={nextRecord.status === "ASSIGNED" ? "warning" : "information"} /></div></Link></OperationalPanel> : null}
      </div>
    </ProtectedContentGrid>
  </ProtectedPageFrame></div>;
}
