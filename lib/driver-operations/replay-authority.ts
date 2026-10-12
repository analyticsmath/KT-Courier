import { prisma } from "@/lib/db/prisma";
import { DriverOperationError } from "./errors";
import type { DriverOperationSnapshot } from "./idempotency";

/** Replay is bound to the actor and aggregate even when the original command
 * version is stale or delivery has since completed. */
export async function assertDriverReplayAuthority(assignmentId: string, driverProfileId: string, driverUserId: string, receipt: DriverOperationSnapshot) {
  if (receipt.assignmentId !== assignmentId || receipt.driverProfileId !== driverProfileId) throw new DriverOperationError("Operation receipt belongs to another assignment.", "DRIVER_OPERATION_FORBIDDEN");
  const assignment = await prisma.orderAssignment.findFirst({ where: { id: assignmentId, orderId: receipt.orderId, driverProfileId, driverProfile: { userId: driverUserId, status: "ACTIVE", user: { status: "ACTIVE", role: "DRIVER" } } }, select: { id: true } });
  if (!assignment) throw new DriverOperationError("Assignment replay is unavailable for this driver.", "DRIVER_OPERATION_FORBIDDEN");
}
