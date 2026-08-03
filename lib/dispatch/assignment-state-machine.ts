import { OrderAssignmentStatus } from "@/types/db";

const transitions: Record<OrderAssignmentStatus, readonly OrderAssignmentStatus[]> = {
  ASSIGNED: [OrderAssignmentStatus.ACCEPTED, OrderAssignmentStatus.REJECTED, OrderAssignmentStatus.EXPIRED, OrderAssignmentStatus.REVOKED, OrderAssignmentStatus.SUPERSEDED],
  ACCEPTED: [OrderAssignmentStatus.REVOKED, OrderAssignmentStatus.SUPERSEDED, OrderAssignmentStatus.COMPLETED],
  REJECTED: [], CANCELLED: [], COMPLETED: [], EXPIRED: [], REVOKED: [], SUPERSEDED: [],
};

export function canTransitionAssignment(from: OrderAssignmentStatus, to: OrderAssignmentStatus): boolean {
  return transitions[from].includes(to);
}

export function isCurrentAssignment(status: OrderAssignmentStatus): boolean {
  return status === OrderAssignmentStatus.ASSIGNED || status === OrderAssignmentStatus.ACCEPTED;
}

export function isTerminalAssignment(status: OrderAssignmentStatus): boolean {
  return !isCurrentAssignment(status);
}

export const assignmentTransitions = transitions;
