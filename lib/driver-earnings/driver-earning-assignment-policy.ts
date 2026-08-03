import { DriverEarningError } from "./errors";

export type AssignmentEvidence = Readonly<{
  id: string; publicReference: string; version: string; driverId: string; orderId: string;
  status: string; completedAt: string | null; podAssignmentId: string | null; podDriverId: string | null;
  podOrderId: string | null; podDeliveredAt: string | null; hasDeliveryCompletedEvent: boolean; hasAssignmentCompletedEvent: boolean;
}>;

export function assertAuthoritativeAssignment(input: AssignmentEvidence, expected: Readonly<{ assignmentId: string; assignmentPublicReference: string; assignmentVersion: string; driverId: string; orderId: string; serviceCompletedAt: string }>): void {
  if (input.id !== expected.assignmentId || input.publicReference !== expected.assignmentPublicReference || input.driverId !== expected.driverId || input.orderId !== expected.orderId) throw new DriverEarningError("DRIVER_EARNING_ASSIGNMENT_INVALID", "Assignment, driver, or order identity does not match the settlement.");
  if (input.version !== expected.assignmentVersion) throw new DriverEarningError("DRIVER_EARNING_ASSIGNMENT_INVALID", "Assignment version changed after settlement snapshot creation.");
  const completed = input.status === "COMPLETED" && input.completedAt === expected.serviceCompletedAt;
  const podMatches = input.podAssignmentId === input.id && input.podDriverId === input.driverId && input.podOrderId === input.orderId && input.podDeliveredAt === expected.serviceCompletedAt;
  if (!completed || !podMatches || !input.hasDeliveryCompletedEvent || !input.hasAssignmentCompletedEvent) throw new DriverEarningError("DRIVER_EARNING_DELIVERY_EVIDENCE_INVALID", "Authoritative delivery-completion evidence is missing or conflicting.");
}

export function assertUnambiguousHandoff(input: Readonly<{ settledAssignmentIds: readonly string[]; settledDriverIds: readonly string[]; independentBasisCount: number }>): void {
  if (new Set(input.settledAssignmentIds).size !== input.settledAssignmentIds.length || input.settledAssignmentIds.length !== input.settledDriverIds.length || input.independentBasisCount !== input.settledAssignmentIds.length) throw new DriverEarningError("DRIVER_EARNING_ASSIGNMENT_INVALID", "Delivery handoff attribution is ambiguous.");
}
