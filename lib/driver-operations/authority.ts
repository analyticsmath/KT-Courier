import { prisma } from "@/lib/db/prisma";
import { OrderAssignmentStatus, OrderStatus } from "@/types/db";
import { DriverOperationError } from "./errors";
import type { OperationalAssignmentSnapshot } from "./types";

const TERMINAL = new Set<OrderStatus>([
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.FAILED,
]);

export async function assertAcceptedCurrentDriver(
  assignmentId: string,
  driverProfileId: string,
  expectedVersion?: number
): Promise<OperationalAssignmentSnapshot> {
  const assignment = await prisma.orderAssignment.findFirst({
    where: { id: assignmentId, driverProfileId },
    select: {
      id: true,
      version: true,
      status: true,
      driverProfileId: true,
      order: { select: { id: true, status: true, currentDriverProfileId: true } },
      driverProfile: { select: { userId: true, status: true, user: { select: { status: true, role: true } } } },
    },
  });

  if (!assignment) throw new DriverOperationError("Assignment not found.", "DRIVER_OPERATION_FORBIDDEN");
  if (expectedVersion !== undefined && assignment.version !== expectedVersion) {
    throw new DriverOperationError("Assignment is stale. Refresh the workbench and retry.", "DRIVER_OPERATION_STALE");
  }
  if (assignment.status !== OrderAssignmentStatus.ACCEPTED || assignment.order.currentDriverProfileId !== driverProfileId) {
    throw new DriverOperationError("Only the current accepted driver can operate this order.", "DRIVER_OPERATION_FORBIDDEN");
  }
  if (assignment.driverProfile.status !== "ACTIVE" || assignment.driverProfile.user.status !== "ACTIVE" || assignment.driverProfile.user.role !== "DRIVER") {
    throw new DriverOperationError("Driver profile is not active.", "DRIVER_OPERATION_FORBIDDEN");
  }
  if (TERMINAL.has(assignment.order.status)) {
    throw new DriverOperationError("Terminal orders cannot be operated.", "DRIVER_OPERATION_TERMINAL");
  }

  return {
    assignmentId: assignment.id,
    assignmentVersion: assignment.version,
    assignmentStatus: assignment.status,
    orderId: assignment.order.id,
    orderStatus: assignment.order.status,
    currentDriverProfileId: assignment.order.currentDriverProfileId,
    driverProfileId: assignment.driverProfileId,
    driverActive: true,
    driverUserId: assignment.driverProfile.userId,
  };
}
