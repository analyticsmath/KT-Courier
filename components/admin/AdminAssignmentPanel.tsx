import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AssignOrderForm } from "./AssignOrderForm";
import { CancelAssignmentForm } from "./CancelAssignmentForm";
import { formatDateTime } from "@/lib/utils/formatters";
import { ASSIGNMENT_STATUS_LABELS, ASSIGNMENT_EVENT_LABELS } from "@/lib/constants/assignments";
import type { AdminAssignmentDto } from "@/lib/dto/assignment.dto";
import type { DriverEligibilityDto } from "@/lib/dto/assignment.dto";
import { OrderAssignmentStatus } from "@/types/db";

interface Props {
  orderId: string;
  activeAssignment: AdminAssignmentDto | null;
  history: AdminAssignmentDto[];
  eligibleDrivers: DriverEligibilityDto[];
  orderStatus: string;
  isAssignable: boolean;
}

function statusBadgeVariant(status: OrderAssignmentStatus): "green" | "blue" | "amber" | "red" | "gray" {
  if (status === "ACCEPTED") return "green";
  if (status === "ASSIGNED") return "blue";
  if (status === "REJECTED") return "red";
  return "gray";
}

export function AdminAssignmentPanel({
  orderId,
  activeAssignment,
  history,
  eligibleDrivers,
  orderStatus,
  isAssignable,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Active assignment */}
      {activeAssignment ? (
        <div className="p-4 rounded-2xl border border-[var(--kt-signal-cobalt)]/30 bg-[var(--kt-signal-cobalt)]/5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide">Active Assignment</p>
              <p className="text-base font-bold text-[var(--kt-ink-navy)] mt-0.5">
                {activeAssignment.driverDisplayName || activeAssignment.driverCode}
              </p>
              <p className="text-xs text-[var(--kt-text-muted)]">{activeAssignment.driverCode}</p>
            </div>
            <Badge variant={statusBadgeVariant(activeAssignment.status)}>
              {ASSIGNMENT_STATUS_LABELS[activeAssignment.status]}
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <dt className="text-[var(--kt-text-muted)] font-medium">Vehicle</dt>
              <dd className="text-[var(--kt-ink-navy)] font-semibold capitalize">
                {activeAssignment.vehicleType?.toLowerCase() || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--kt-text-muted)] font-medium">Phone</dt>
              <dd className="text-[var(--kt-ink-navy)] font-semibold">
                {activeAssignment.driverPhone || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--kt-text-muted)] font-medium">Assigned at</dt>
              <dd className="text-[var(--kt-ink-navy)]">{formatDateTime(activeAssignment.assignedAt)}</dd>
            </div>
            {activeAssignment.acceptedAt && (
              <div>
                <dt className="text-[var(--kt-text-muted)] font-medium">Accepted at</dt>
                <dd className="text-[var(--kt-ink-navy)]">{formatDateTime(activeAssignment.acceptedAt)}</dd>
              </div>
            )}
            {activeAssignment.adminNote && (
              <div className="col-span-2">
                <dt className="text-[var(--kt-text-muted)] font-medium">Admin note</dt>
                <dd className="text-[var(--kt-ink-navy)] italic">{activeAssignment.adminNote}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--kt-soft-border)]">
            <AssignOrderForm
              orderId={orderId}
              eligibleDrivers={eligibleDrivers}
              currentDriverId={activeAssignment.driverProfileId}
              currentAssignmentId={activeAssignment.id}
              currentAssignmentVersion={activeAssignment.version}
              isReassign
            />
            <CancelAssignmentForm orderId={orderId} assignmentId={activeAssignment.id} expectedVersion={activeAssignment.version} />
            <Button href={`/admin/drivers/${activeAssignment.driverProfileId}`} variant="ghost" size="sm">
              View Driver
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-[var(--kt-studio-white)] border border-[var(--kt-soft-border)] space-y-3">
          <p className="text-sm font-semibold text-[var(--kt-text-muted)]">No driver currently assigned.</p>
          {isAssignable ? (
            <AssignOrderForm orderId={orderId} eligibleDrivers={eligibleDrivers} />
          ) : (
            <p className="text-xs text-[var(--kt-text-muted)]">
              This order cannot be assigned in its current status ({orderStatus}).
              Orders must be CONFIRMED or PICKUP_SCHEDULED to assign a driver.
            </p>
          )}
        </div>
      )}

      {/* Phase 2.6 note */}
      <div className="p-3 rounded-xl bg-[var(--kt-mint-wash)] border border-[var(--kt-teal-emerald)]/20 text-xs text-[var(--kt-text-muted)]">
        Pickup actions (proof of collection, custody transfer) will be available in Phase 2.6.
      </div>

      {/* Assignment history */}
      {history.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-[var(--kt-text-muted)] uppercase tracking-wide mb-3">
            Assignment History
          </h3>
          <ol className="space-y-3">
            {history.map((a, idx) => {
              const isFirst = idx === 0;
              return (
                <li key={a.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
                        isFirst ? "bg-[var(--kt-signal-cobalt)]" : "bg-[var(--kt-soft-border)]"
                      }`}
                    />
                    {idx < history.length - 1 && (
                      <span className="w-px flex-1 bg-[var(--kt-soft-border)] mt-1" />
                    )}
                  </div>
                  <div className="pb-3 min-w-0">
                    <p className="text-sm font-semibold text-[var(--kt-ink-navy)]">
                      {a.driverDisplayName || a.driverCode}
                    </p>
                    <Badge variant={statusBadgeVariant(a.status)} className="text-xs">
                      {ASSIGNMENT_STATUS_LABELS[a.status]}
                    </Badge>
                    <p className="text-xs text-[var(--kt-text-muted)] mt-1">
                      {formatDateTime(a.assignedAt)}
                    </p>
                    {a.cancellationReason && (
                      <p className="text-xs text-[var(--kt-copper-flame)] mt-0.5">
                        Cancelled: {a.cancellationReason}
                      </p>
                    )}
                    {a.rejectionReason && (
                      <p className="text-xs text-[var(--kt-signal-red)] mt-0.5">
                        Rejected: {a.rejectionReason}
                      </p>
                    )}
                    {/* Events */}
                    {a.events.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {a.events.map((ev) => (
                          <li key={ev.id} className="text-xs text-[var(--kt-text-muted)]">
                            {ASSIGNMENT_EVENT_LABELS[ev.eventType]}
                            {ev.note ? ` — ${ev.note}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
