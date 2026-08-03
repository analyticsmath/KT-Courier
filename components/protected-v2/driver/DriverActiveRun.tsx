import Link from "next/link";
import type { DriverAssignmentDto } from "@/lib/dto/assignment.dto";
import { getDriverNextAction } from "@/lib/driver-presentation/driver-state";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";

export function DriverActiveRun({ assignment, compact = false }: { assignment: DriverAssignmentDto; compact?: boolean }) {
  const nextAction = getDriverNextAction(assignment);
  return (
    <section className="eo-driver-active-run" aria-labelledby={`active-run-${assignment.id}`}>
      <div className="eo-driver-active-run__header">
        <div className="min-w-0">
          <p className="eo-driver-record__reference">{assignment.orderNumber}</p>
          <h2 id={`active-run-${assignment.id}`}>{compact ? "Current assignment" : "Active run"}</h2>
          <p className="eo-driver-meta">Current stage: {assignment.orderStatus.replaceAll("_", " ")}</p>
        </div>
        <ProtectedStatus label={assignment.statusLabel} tone="information" />
      </div>
      <ol className="eo-driver-stop-sequence" aria-label="Assignment stop sequence">
        <li><span><strong>Pickup</strong>{assignment.pickupCity ?? "Location details available in the assignment"}</span></li>
        <li><span><strong>Destination</strong>{assignment.dropoffCity ?? "Location details available in the assignment"}</span></li>
      </ol>
      <div className="eo-driver-next-action">
        <p><strong>Next action</strong>{nextAction}</p>
        <Link className="eo-driver-button eo-driver-button--primary" href={`/driver/assignments/${assignment.id}`}>Open assignment</Link>
      </div>
    </section>
  );
}
