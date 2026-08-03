import { prisma } from "@/lib/db/prisma";
import { OrderAssignmentStatus, OrderAssignmentEventType } from "@/types/db";
import { toDriverAssignmentDto, type DriverAssignmentDto } from "@/lib/dto/assignment.dto";
import {
  ASSIGNMENT_FULL_INCLUDE,
  getAssignmentOwnedByDriver,
  transitionAssignmentInTx,
  requireActiveAssignment,
} from "./assignments.service";
import { isValidAssignmentTransition, ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/constants/assignments";
import type { DriverAcceptAssignmentInput, DriverRejectAssignmentInput } from "@/lib/validation/assignment";

// ─── List driver's own assignments ───────────────────────────────────────────

export async function listDriverAssignments(
  driverProfileId: string,
  filter: "active" | "history" | "all" = "all"
): Promise<DriverAssignmentDto[]> {
  const statusFilter =
    filter === "active"
      ? { in: ACTIVE_ASSIGNMENT_STATUSES }
      : filter === "history"
      ? { notIn: ACTIVE_ASSIGNMENT_STATUSES }
      : undefined;

  const assignments = await prisma.orderAssignment.findMany({
    where: {
      driverProfileId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: ASSIGNMENT_FULL_INCLUDE,
    orderBy: { assignedAt: "desc" },
  });

  return assignments.map(toDriverAssignmentDto);
}

// ─── Get driver's own assignment detail ──────────────────────────────────────

export async function getDriverAssignmentDetail(
  assignmentId: string,
  driverProfileId: string
): Promise<DriverAssignmentDto | null> {
  const assignment = await getAssignmentOwnedByDriver(assignmentId, driverProfileId);
  return assignment ? toDriverAssignmentDto(assignment) : null;
}

// ─── Driver accept assignment ─────────────────────────────────────────────────

export async function acceptAssignment(
  assignmentId: string,
  driverProfileId: string,
  input: DriverAcceptAssignmentInput
): Promise<{ assignment: DriverAssignmentDto } | { error: string }> {
  const assignment = await getAssignmentOwnedByDriver(assignmentId, driverProfileId);

  if (!assignment) return { error: "Assignment not found." };

  const activeCheck = requireActiveAssignment(assignment);
  if (!activeCheck.ok) return { error: activeCheck.error };

  if (!isValidAssignmentTransition(assignment.status, OrderAssignmentStatus.ACCEPTED)) {
    return {
      error: `Cannot accept an assignment in status: ${assignment.status}. Only ASSIGNED assignments can be accepted.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await transitionAssignmentInTx(tx, {
      assignmentId,
      orderId: assignment.orderId,
      driverProfileId,
      actorUserId: assignment.driverProfile.userId,
      actorRole: "DRIVER",
      from: assignment.status,
      to: OrderAssignmentStatus.ACCEPTED,
      eventType: OrderAssignmentEventType.ASSIGNMENT_ACCEPTED,
      data: {
        status: OrderAssignmentStatus.ACCEPTED,
        acceptedAt: new Date(),
        driverNote: input.driverNote ?? null,
      },
      note: input.driverNote,
    });
  });

  const updated = await getAssignmentOwnedByDriver(assignmentId, driverProfileId);
  return { assignment: toDriverAssignmentDto(updated!) };
}

// ─── Driver reject assignment ─────────────────────────────────────────────────

export async function rejectAssignment(
  assignmentId: string,
  driverProfileId: string,
  input: DriverRejectAssignmentInput
): Promise<{ ok: true } | { error: string }> {
  const assignment = await getAssignmentOwnedByDriver(assignmentId, driverProfileId);

  if (!assignment) return { error: "Assignment not found." };

  const activeCheck = requireActiveAssignment(assignment);
  if (!activeCheck.ok) return { error: activeCheck.error };

  if (!isValidAssignmentTransition(assignment.status, OrderAssignmentStatus.REJECTED)) {
    return {
      error: `Cannot reject an assignment in status: ${assignment.status}. Only ASSIGNED assignments can be rejected.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await transitionAssignmentInTx(tx, {
      assignmentId,
      orderId: assignment.orderId,
      driverProfileId,
      actorUserId: assignment.driverProfile.userId,
      actorRole: "DRIVER",
      from: assignment.status,
      to: OrderAssignmentStatus.REJECTED,
      eventType: OrderAssignmentEventType.ASSIGNMENT_REJECTED,
      data: {
        status: OrderAssignmentStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: input.reason,
      },
      note: input.reason,
    });
  });

  return { ok: true };
}

// ─── Get driver profile ID for authenticated driver user ──────────────────────

export async function getDriverProfileIdForUser(userId: string): Promise<string | null> {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}
