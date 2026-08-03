import type { DriverAvailability, DriverStatus } from "@/types/db";

export type DriverAssignmentStateInput = {
  id: string;
  status: string;
  orderStatus: string;
  assignedAt: Date | string;
  acceptedAt?: Date | string | null;
  expiresAt?: Date | string | null;
};

export type DriverOperationalState =
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_ACTION_REQUIRED"
  | "ACTIVE_DELIVERY"
  | "ACTIVE_PICKUP"
  | "ASSIGNMENT_DECISION_REQUIRED"
  | "AVAILABLE_NO_ASSIGNMENT"
  | "UNAVAILABLE"
  | "NO_CURRENT_WORK"
  | "SOURCE_UNAVAILABLE";

export type DriverOperationalPresentation = {
  state: DriverOperationalState;
  label: string;
  description: string;
  tone: "success" | "warning" | "danger" | "information" | "neutral";
  assignmentId: string | null;
};

const DELIVERY_ORDER_STATUSES = new Set(["PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED"]);
const PICKUP_ORDER_STATUSES = new Set(["CONFIRMED", "PICKUP_SCHEDULED"]);
const TERMINAL_ORDER_STATUSES = new Set(["DELIVERED", "COMPLETED", "CANCELLED", "FAILED"]);

/**
 * Chooses a visible driver state only. It deliberately does not authorize or
 * transition an assignment; the existing API and service layer remain the
 * authority for every operation.
 */
export function getDriverOperationalPresentation(args: {
  status: DriverStatus | string;
  availability: DriverAvailability | string;
  assignments: readonly DriverAssignmentStateInput[];
}): DriverOperationalPresentation {
  if (args.status === "SUSPENDED" || args.status === "REJECTED") {
    return {
      state: "ACCOUNT_SUSPENDED",
      label: "Account action required",
      description: "Your driver account cannot receive or operate assignments. Contact KT Couriers support for the current account status.",
      tone: "danger",
      assignmentId: null,
    };
  }

  if (args.status !== "ACTIVE") {
    return {
      state: "ACCOUNT_ACTION_REQUIRED",
      label: "Account review in progress",
      description: "Your driver profile must be active before dispatch and operational actions are available.",
      tone: "warning",
      assignmentId: null,
    };
  }

  const current = args.assignments.filter(
    (assignment) => assignment.status === "ACCEPTED" && !TERMINAL_ORDER_STATUSES.has(assignment.orderStatus),
  );
  const delivery = current.find((assignment) => DELIVERY_ORDER_STATUSES.has(assignment.orderStatus));
  if (delivery) {
    return {
      state: "ACTIVE_DELIVERY",
      label: "Active delivery",
      description: "A current assignment needs delivery-stage attention.",
      tone: "information",
      assignmentId: delivery.id,
    };
  }

  const pickup = current.find((assignment) => PICKUP_ORDER_STATUSES.has(assignment.orderStatus));
  if (pickup) {
    return {
      state: "ACTIVE_PICKUP",
      label: "Active pickup",
      description: "A current assignment is ready for its pickup-stage action.",
      tone: "information",
      assignmentId: pickup.id,
    };
  }

  const offer = args.assignments.find((assignment) => assignment.status === "ASSIGNED");
  if (offer) {
    return {
      state: "ASSIGNMENT_DECISION_REQUIRED",
      label: "Assignment decision required",
      description: "Review the dispatched assignment and use the canonical accept or reject action.",
      tone: "warning",
      assignmentId: offer.id,
    };
  }

  if (args.availability === "AVAILABLE") {
    return {
      state: "AVAILABLE_NO_ASSIGNMENT",
      label: "Available for dispatch",
      description: "You are available. An assignment will appear here only when dispatch assigns one to you.",
      tone: "success",
      assignmentId: null,
    };
  }

  if (args.availability === "UNAVAILABLE" || args.availability === "OFFLINE") {
    return {
      state: "UNAVAILABLE",
      label: args.availability === "OFFLINE" ? "Offline" : "Unavailable",
      description: "You are not currently available for dispatch.",
      tone: "neutral",
      assignmentId: null,
    };
  }

  return {
    state: "SOURCE_UNAVAILABLE",
    label: "Operational state unavailable",
    description: "The current driver availability state could not be interpreted. Refresh this page or contact support before taking action.",
    tone: "warning",
    assignmentId: null,
  };
}

export function getDriverNextAction(assignment: Pick<DriverAssignmentStateInput, "id" | "status" | "orderStatus">): string {
  if (assignment.status === "ASSIGNED") return "Review assignment";
  if (assignment.status !== "ACCEPTED") return "View assignment record";
  if (PICKUP_ORDER_STATUSES.has(assignment.orderStatus)) return "Open pickup actions";
  if (assignment.orderStatus === "PICKED_UP") return "Start delivery";
  if (assignment.orderStatus === "IN_TRANSIT") return "Continue delivery";
  if (assignment.orderStatus === "DELIVERY_ATTEMPTED") return "Review delivery attempt";
  if (TERMINAL_ORDER_STATUSES.has(assignment.orderStatus)) return "View completed record";
  return "Review current status";
}
