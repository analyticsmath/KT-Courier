import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { getEffectivePermissionKeysForUser } from "@/lib/auth/permissions";
import { adminUpdateUser } from "@/lib/services/admin-users.service";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import {
  recordSecurityEvent,
  SECURITY_EVENT_TYPES,
} from "@/lib/services/security-events.service";
import { AdminActionType, UserRole, UserStatus } from "@/types/db";

export type EmployeeServiceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT";

export class EmployeeServiceError extends Error {
  constructor(
    public readonly code: EmployeeServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "EmployeeServiceError";
  }
}

export interface EmployeeActor {
  id: string;
  role: UserRole;
}

export interface CreateAdminEmployeeInput {
  email: string;
  password: string;
  name?: string | null;
  displayName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  phone?: string | null;
  status?: UserStatus;
}

export interface UpdateAdminEmployeeInput {
  name?: string | null;
  displayName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  phone?: string | null;
  status?: UserStatus;
}

function assertSuperAdmin(actor: EmployeeActor): void {
  if (actor.role !== UserRole.SUPER_ADMIN) {
    throw new EmployeeServiceError("FORBIDDEN", "Super admin access is required.");
  }
}

function serializeAdminEmployee(
  user: Awaited<ReturnType<typeof getAdminEmployeeRecord>>
) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    status: user.status,
    adminProfile: user.adminProfile
      ? {
          id: user.adminProfile.id,
          displayName: user.adminProfile.displayName,
          jobTitle: user.adminProfile.jobTitle,
          department: user.adminProfile.department,
          phone: user.adminProfile.phone,
          createdAt: user.adminProfile.createdAt,
          updatedAt: user.adminProfile.updatedAt,
        }
      : null,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

async function getAdminEmployeeRecord(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { adminProfile: true },
  });
}

async function assertCanModifyEmployee(args: {
  actor: EmployeeActor;
  target: NonNullable<Awaited<ReturnType<typeof getAdminEmployeeRecord>>>;
  status?: UserStatus;
  request?: Request;
}) {
  if (args.target.role !== UserRole.ADMIN && args.target.role !== UserRole.SUPER_ADMIN) {
    throw new EmployeeServiceError("VALIDATION", "Target user is not an admin employee.");
  }

  if (args.actor.role !== UserRole.SUPER_ADMIN && args.target.role === UserRole.SUPER_ADMIN) {
    await recordSecurityEvent({
      type: SECURITY_EVENT_TYPES.SUPER_ADMIN_PROTECTION_TRIGGERED,
      severity: "HIGH",
      userId: args.target.id,
      actorUserId: args.actor.id,
      message: "Blocked normal admin attempt to modify super admin employee",
      request: args.request,
    });
    throw new EmployeeServiceError("FORBIDDEN", "Admins cannot modify super admin accounts.");
  }

  if (
    args.status !== undefined &&
    args.status !== args.target.status &&
    args.actor.id === args.target.id
  ) {
    await recordSecurityEvent({
      type: SECURITY_EVENT_TYPES.SELF_PERMISSION_CHANGE_BLOCKED,
      severity: "HIGH",
      userId: args.target.id,
      actorUserId: args.actor.id,
      message: "Blocked admin self-status change from employee endpoint",
      request: args.request,
      metadata: { attemptedStatus: args.status },
    });
    throw new EmployeeServiceError(
      "FORBIDDEN",
      "Admins cannot change their own employee account status."
    );
  }
}

export async function listAdminEmployees() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    },
    include: { adminProfile: true },
    orderBy: [{ role: "desc" }, { createdAt: "desc" }],
  });

  const employees = await Promise.all(
    users.map(async (user) => {
      const effectivePermissionKeys = await getEffectivePermissionKeysForUser({
        userId: user.id,
        role: user.role,
      });

      return {
        ...serializeAdminEmployee(user)!,
        effectivePermissionCount: effectivePermissionKeys.length,
      };
    })
  );

  return employees;
}

export async function getAdminEmployee(id: string) {
  const user = await getAdminEmployeeRecord(id);
  if (!user) return null;
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) return null;

  const effectivePermissionKeys = await getEffectivePermissionKeysForUser({
    userId: user.id,
    role: user.role,
  });

  return {
    ...serializeAdminEmployee(user)!,
    effectivePermissionKeys,
    effectivePermissionCount: effectivePermissionKeys.length,
  };
}

export async function createAdminEmployee(args: {
  input: CreateAdminEmployeeInput;
  actor: EmployeeActor;
  request?: Request;
}) {
  assertSuperAdmin(args.actor);

  const email = args.input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new EmployeeServiceError("CONFLICT", "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(args.input.password);
  const user = await prisma.$transaction(async (tx) =>
    tx.user.create({
      data: {
        email,
        passwordHash,
        name: args.input.name?.trim() || null,
        phone: args.input.phone?.trim() || null,
        role: UserRole.ADMIN,
        status: args.input.status ?? UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        adminProfile: {
          create: {
            displayName:
              args.input.displayName?.trim() || args.input.name?.trim() || null,
            jobTitle: args.input.jobTitle?.trim() || null,
            department: args.input.department?.trim() || null,
            phone: args.input.phone?.trim() || null,
          },
        },
      },
      include: { adminProfile: true },
    })
  );

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.EMPLOYEE_CREATED,
    severity: "HIGH",
    userId: user.id,
    actorUserId: args.actor.id,
    message: "Admin employee account created",
    request: args.request,
    metadata: { email: user.email, status: user.status },
  });

  await recordAdminActivity({
    actorUserId: args.actor.id,
    action: AdminActionType.CREATE,
    entityType: "User",
    entityId: user.id,
    message: `Created admin employee ${user.email}`,
    metadata: { role: user.role, status: user.status },
  });

  return serializeAdminEmployee(user);
}

export async function updateAdminEmployee(args: {
  id: string;
  input: UpdateAdminEmployeeInput;
  actor: EmployeeActor;
  request?: Request;
}) {
  const target = await getAdminEmployeeRecord(args.id);
  if (!target) throw new EmployeeServiceError("NOT_FOUND", "Admin employee not found.");

  await assertCanModifyEmployee({
    actor: args.actor,
    target,
    status: args.input.status,
    request: args.request,
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: {
        ...(args.input.name !== undefined && {
          name: args.input.name?.trim() || null,
        }),
        ...(args.input.phone !== undefined && {
          phone: args.input.phone?.trim() || null,
        }),
      },
    });

    await tx.adminProfile.upsert({
      where: { userId: target.id },
      update: {
        ...(args.input.displayName !== undefined && {
          displayName: args.input.displayName?.trim() || null,
        }),
        ...(args.input.jobTitle !== undefined && {
          jobTitle: args.input.jobTitle?.trim() || null,
        }),
        ...(args.input.department !== undefined && {
          department: args.input.department?.trim() || null,
        }),
        ...(args.input.phone !== undefined && {
          phone: args.input.phone?.trim() || null,
        }),
      },
      create: {
        userId: target.id,
        displayName:
          args.input.displayName?.trim() || args.input.name?.trim() || target.name,
        jobTitle: args.input.jobTitle?.trim() || null,
        department: args.input.department?.trim() || null,
        phone: args.input.phone?.trim() || null,
      },
    });
  });

  if (args.input.status !== undefined && args.input.status !== target.status) {
    await adminUpdateUser(
      target.id,
      { status: args.input.status },
      { actorUserId: args.actor.id, request: args.request }
    );
  }

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.EMPLOYEE_UPDATED,
    severity:
      args.input.status !== undefined && args.input.status !== target.status
        ? "HIGH"
        : "INFO",
    userId: target.id,
    actorUserId: args.actor.id,
    message: "Admin employee account updated",
    request: args.request,
    metadata: {
      changes: Object.keys(args.input),
    },
  });

  await recordAdminActivity({
    actorUserId: args.actor.id,
    action: AdminActionType.UPDATE,
    entityType: "User",
    entityId: target.id,
    message: `Updated admin employee ${target.email}`,
    metadata: { changes: Object.keys(args.input) },
  });

  return getAdminEmployee(target.id);
}
