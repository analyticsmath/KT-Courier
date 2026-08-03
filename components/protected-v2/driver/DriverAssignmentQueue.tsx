import Link from "next/link";
import type { DriverAssignmentDto } from "@/lib/dto/assignment.dto";
import { prioritiseDriverAssignments } from "@/lib/driver-presentation/assignment-priority";
import { getDriverNextAction } from "@/lib/driver-presentation/driver-state";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { RouteQueueIllustration } from "@/components/protected-v2/illustrations/RouteQueueIllustration";
import styles from "./driver-pages.module.css";

function statusTone(assignment: DriverAssignmentDto): "success" | "warning" | "information" | "neutral" | "danger" {
  if (assignment.status === "ASSIGNED") return "warning";
  if (assignment.status === "ACCEPTED") return "information";
  if (assignment.status === "REJECTED" || assignment.status === "CANCELLED") return "neutral";
  return "neutral";
}

function formatDate(value: Date | string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DriverAssignmentQueue({ assignments, filter = "all", title = "Assignments", description = "Current work is ordered by canonical stage. Offers and active assignments remain server-authoritative." }: { assignments: readonly DriverAssignmentDto[]; filter?: "all" | "active" | "history"; title?: string; description?: string }) {
  const rows = prioritiseDriverAssignments(assignments);
  const activeCount = rows.filter((row) => row.status === "ASSIGNED" || row.status === "ACCEPTED").length;
  return <div className={styles.scope}>
    <div className="eo-driver-filter-nav" aria-label="Assignment filters">
      <Link aria-current={filter === "all" ? "page" : undefined} href="/driver/assignments">All</Link>
      <Link aria-current={filter === "active" ? "page" : undefined} href="/driver/assignments?filter=active">Active{activeCount ? ` (${activeCount})` : ""}</Link>
      <Link aria-current={filter === "history" ? "page" : undefined} href="/driver/assignments?filter=history">History</Link>
    </div>
    <div className="mt-4">
      <OperationalPanel title={title} description={description} padding="compact">
        {!rows.length ? <ProtectedState kind="empty" title="No assignments in this view" description={filter === "active" ? "There is no active or decision-required assignment right now." : "Assignments appear only after KT Couriers dispatches an owned record to you."} illustration={<RouteQueueIllustration className="h-24 w-32" />} /> : (
          <ol className="eo-driver-record-list" aria-label="Driver assignments">
            {rows.map((assignment) => <li className="eo-driver-record" key={assignment.id}>
              <Link className="eo-driver-record__link" href={`/driver/assignments/${assignment.id}`}>
                <div className="eo-driver-record__header">
                  <div className="min-w-0"><p className="eo-driver-record__reference">{assignment.orderNumber}</p><p className="eo-driver-record__route">{assignment.pickupCity ?? "Pickup"} → {assignment.dropoffCity ?? "Destination"}</p></div>
                  <ProtectedStatus label={assignment.statusLabel} tone={statusTone(assignment)} />
                </div>
                <p className="eo-driver-record__facts"><span>{getDriverNextAction(assignment)}</span><span>Order status: {assignment.orderStatus.replaceAll("_", " ")}</span>{assignment.status === "ASSIGNED" && assignment.expiresAt ? <span>Decision deadline: {formatDate(assignment.expiresAt)}</span> : <span>Assigned: {formatDate(assignment.assignedAt)}</span>}</p>
              </Link>
            </li>)}
          </ol>
        )}
      </OperationalPanel>
    </div>
  </div>;
}
