import type { DriverAssignmentStateInput } from "./driver-state";

type PrioritisedAssignment = DriverAssignmentStateInput & { id: string };

const ORDER_STAGE_PRIORITY: Record<string, number> = {
  DELIVERY_ATTEMPTED: 0,
  IN_TRANSIT: 1,
  PICKED_UP: 2,
  PICKUP_SCHEDULED: 3,
  CONFIRMED: 4,
};

function timestamp(value: Date | string | null | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Presentation ordering only: current accepted work, then a decision-required
 * offer, then all other records. Ties use canonical assigned/accepted and offer
 * times; no urgency score, ETA, distance, or client-generated priority exists.
 */
export function prioritiseDriverAssignments<T extends PrioritisedAssignment>(assignments: readonly T[]): T[] {
  return [...assignments].sort((left, right) => {
    const rank = (assignment: T) => {
      if (assignment.status === "ACCEPTED") return ORDER_STAGE_PRIORITY[assignment.orderStatus] ?? 5;
      if (assignment.status === "ASSIGNED") return 6;
      return 10;
    };
    const rankDelta = rank(left) - rank(right);
    if (rankDelta) return rankDelta;

    if (left.status === "ASSIGNED" && right.status === "ASSIGNED") {
      const expiryDelta = timestamp(left.expiresAt, Number.MAX_SAFE_INTEGER) - timestamp(right.expiresAt, Number.MAX_SAFE_INTEGER);
      if (expiryDelta) return expiryDelta;
    }

    const acceptedDelta = timestamp(left.acceptedAt, Number.MAX_SAFE_INTEGER) - timestamp(right.acceptedAt, Number.MAX_SAFE_INTEGER);
    if (acceptedDelta) return acceptedDelta;
    return timestamp(right.assignedAt, 0) - timestamp(left.assignedAt, 0);
  });
}
