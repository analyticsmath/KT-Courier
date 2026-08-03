import { prisma } from "@/lib/db/prisma";
import {
  PERMISSIONS,
  SYSTEM_PERMISSION_DEFINITIONS,
  type PermissionKey,
} from "@/lib/auth/permission-keys";
import {
  getEffectivePermissionKeysForUser,
  hasPermission,
  syncSystemPermissions as syncSystemPermissionRegistry,
} from "@/lib/auth/permissions";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import {
  recordSecurityEvent,
  SECURITY_EVENT_TYPES,
} from "@/lib/services/security-events.service";
import { AdminActionType, PermissionEffect, UserRole, type Permission } from "@/types/db";

export type PermissionServiceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT";

export class PermissionServiceError extends Error {
  constructor(
    public readonly code: PermissionServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PermissionServiceError";
  }
}

export interface PermissionActor {
  id: string;
  role: UserRole;
}

export interface UserPermissionOverrideInput {
  permissionKey: string;
  effect: PermissionEffect;
  reason?: string | null;
}

function assertSuperAdmin(actor: PermissionActor): void {
  if (actor.role !== UserRole.SUPER_ADMIN) {
    throw new PermissionServiceError("FORBIDDEN", "Super admin access is required.");
  }
}

function assertAdminRole(role: UserRole): void {
  if (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN) {
    throw new PermissionServiceError("VALIDATION", "Role is not an admin role.");
  }
}

async function getTargetAdminUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { adminProfile: true },
  });
  if (!user) throw new PermissionServiceError("NOT_FOUND", "Admin employee not found.");
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
    throw new PermissionServiceError("VALIDATION", "Target user is not an admin employee.");
  }
  return user;
}

async function loadPermissionsByKey(keys: string[]): Promise<Map<string, Permission>> {
  const uniqueKeys = Array.from(new Set(keys));
  const permissions = await prisma.permission.findMany({
    where: { key: { in: uniqueKeys } },
  });
  const byKey = new Map(permissions.map((permission) => [permission.key, permission]));

  const missing = uniqueKeys.filter((key) => !byKey.has(key));
  if (missing.length > 0) {
    throw new PermissionServiceError(
      "VALIDATION",
      `Unknown permission key: ${missing.join(", ")}`
    );
  }

  return byKey;
}

export async function listPermissions() {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
    acc[permission.category] ??= [];
    acc[permission.category].push(permission);
    return acc;
  }, {});

  return {
    definitions: SYSTEM_PERMISSION_DEFINITIONS,
    permissions,
    grouped,
  };
}

export async function syncSystemPermissions(args: {
  actor: PermissionActor;
  request?: Request;
}) {
  assertSuperAdmin(args.actor);

  const result = await syncSystemPermissionRegistry({ actorUserId: args.actor.id });

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.PERMISSIONS_SYNCED,
    severity: "INFO",
    actorUserId: args.actor.id,
    message: "System permissions synced",
    request: args.request,
    metadata: result,
  });

  await recordAdminActivity({
    actorUserId: args.actor.id,
    action: AdminActionType.SYSTEM,
    entityType: "Permission",
    message: "Synced system permissions",
    metadata: result,
  });

  return result;
}

export async function getRolePermissions(role: UserRole) {
  assertAdminRole(role);

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role },
    include: { permission: true },
    orderBy: [{ permission: { category: "asc" } }, { permission: { key: "asc" } }],
  });

  return {
    role,
    permissions: rolePermissions.map((rolePermission) => ({
      id: rolePermission.id,
      permissionId: rolePermission.permissionId,
      key: rolePermission.permission.key,
      name: rolePermission.permission.name,
      category: rolePermission.permission.category,
      enabled: rolePermission.enabled,
    })),
    enabledPermissionKeys: rolePermissions
      .filter((rolePermission) => rolePermission.enabled)
      .map((rolePermission) => rolePermission.permission.key)
      .sort(),
  };
}

export async function updateRolePermissions(args: {
  role: UserRole;
  permissionKeys: string[];
  actor: PermissionActor;
  request?: Request;
}) {
  assertSuperAdmin(args.actor);
  assertAdminRole(args.role);

  if (args.role === UserRole.SUPER_ADMIN) {
    throw new PermissionServiceError(
      "VALIDATION",
      "SUPER_ADMIN bypasses permissions and does not use editable role defaults."
    );
  }

  const permissionsByKey = await loadPermissionsByKey(args.permissionKeys);
  const permissionIds = Array.from(permissionsByKey.values()).map((permission) => permission.id);

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.updateMany({
      where: {
        role: args.role,
        ...(permissionIds.length > 0 ? { permissionId: { notIn: permissionIds } } : {}),
      },
      data: { enabled: false },
    });

    for (const permission of permissionsByKey.values()) {
      await tx.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: args.role,
            permissionId: permission.id,
          },
        },
        update: { enabled: true },
        create: {
          role: args.role,
          permissionId: permission.id,
          enabled: true,
        },
      });
    }
  });

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.ROLE_PERMISSIONS_UPDATED,
    severity: "HIGH",
    actorUserId: args.actor.id,
    message: "Role default permissions updated",
    request: args.request,
    metadata: {
      role: args.role,
      permissionKeys: args.permissionKeys,
    },
  });

  await recordAdminActivity({
    actorUserId: args.actor.id,
    action: AdminActionType.UPDATE,
    entityType: "RolePermission",
    entityId: args.role,
    message: `Updated ${args.role} role permissions`,
    metadata: { permissionKeys: args.permissionKeys },
  });

  return getRolePermissions(args.role);
}

export async function getUserPermissionOverrides(userId: string) {
  await getTargetAdminUser(userId);

  const overrides = await prisma.userPermission.findMany({
    where: { userId },
    include: { permission: true, createdBy: { select: { id: true, email: true, name: true } } },
    orderBy: [{ permission: { category: "asc" } }, { permission: { key: "asc" } }],
  });

  return overrides.map((override) => ({
    id: override.id,
    permissionId: override.permissionId,
    permissionKey: override.permission.key,
    permissionName: override.permission.name,
    category: override.permission.category,
    effect: override.effect,
    reason: override.reason,
    createdBy: override.createdBy,
    createdAt: override.createdAt,
    updatedAt: override.updatedAt,
  }));
}

async function assertCanUpdateUserOverrides(args: {
  targetUserId: string;
  targetRole: UserRole;
  actor: PermissionActor;
  overrides: UserPermissionOverrideInput[];
  request?: Request;
}) {
  if (args.actor.id === args.targetUserId) {
    await recordSecurityEvent({
      type: SECURITY_EVENT_TYPES.SELF_PERMISSION_CHANGE_BLOCKED,
      severity: "HIGH",
      userId: args.targetUserId,
      actorUserId: args.actor.id,
      message: "Blocked self permission override update",
      request: args.request,
    });
    throw new PermissionServiceError(
      "FORBIDDEN",
      "Admins cannot modify their own permission overrides."
    );
  }

  if (args.actor.role !== UserRole.SUPER_ADMIN) {
    if (args.targetRole === UserRole.SUPER_ADMIN) {
      await recordSecurityEvent({
        type: SECURITY_EVENT_TYPES.SUPER_ADMIN_PROTECTION_TRIGGERED,
        severity: "HIGH",
        userId: args.targetUserId,
        actorUserId: args.actor.id,
        message: "Blocked normal admin attempt to modify super admin permissions",
        request: args.request,
      });
      throw new PermissionServiceError(
        "FORBIDDEN",
        "Admins cannot modify super admin permissions."
      );
    }

    const canManagePermissions = await hasPermission({
      userId: args.actor.id,
      role: args.actor.role,
      permissionKey: PERMISSIONS.EMPLOYEES_PERMISSIONS_MANAGE,
    });

    if (!canManagePermissions) {
      throw new PermissionServiceError(
        "FORBIDDEN",
        "Employee permission management is required."
      );
    }

    for (const override of args.overrides) {
      if (override.permissionKey === PERMISSIONS.EMPLOYEES_PERMISSIONS_MANAGE) {
        throw new PermissionServiceError(
          "FORBIDDEN",
          "Only super admins can update employee permission management grants."
        );
      }

      const actorHasPermission = await hasPermission({
        userId: args.actor.id,
        role: args.actor.role,
        permissionKey: override.permissionKey,
      });
      if (!actorHasPermission) {
        throw new PermissionServiceError(
          "FORBIDDEN",
          `Admins cannot grant or deny permissions they do not have: ${override.permissionKey}`
        );
      }
    }
  }
}

export async function updateUserPermissionOverrides(args: {
  userId: string;
  overrides: UserPermissionOverrideInput[];
  actor: PermissionActor;
  request?: Request;
}) {
  const target = await getTargetAdminUser(args.userId);

  await assertCanUpdateUserOverrides({
    targetUserId: target.id,
    targetRole: target.role,
    actor: args.actor,
    overrides: args.overrides,
    request: args.request,
  });

  const permissionsByKey = await loadPermissionsByKey(
    args.overrides.map((override) => override.permissionKey)
  );

  const seen = new Set<string>();
  for (const override of args.overrides) {
    if (seen.has(override.permissionKey)) {
      throw new PermissionServiceError(
        "VALIDATION",
        `Duplicate permission override: ${override.permissionKey}`
      );
    }
    seen.add(override.permissionKey);
  }

  await prisma.$transaction(async (tx) => {
    const permissionIdsToKeep = args.overrides.map(
      (override) => permissionsByKey.get(override.permissionKey)!.id
    );

    await tx.userPermission.deleteMany({
      where: {
        userId: target.id,
        ...(permissionIdsToKeep.length > 0
          ? { permissionId: { notIn: permissionIdsToKeep } }
          : {}),
      },
    });

    for (const override of args.overrides) {
      const permission = permissionsByKey.get(override.permissionKey);
      if (!permission) continue;

      await tx.userPermission.upsert({
        where: {
          userId_permissionId: {
            userId: target.id,
            permissionId: permission.id,
          },
        },
        update: {
          effect: override.effect,
          reason: override.reason?.trim() || null,
          createdByUserId: args.actor.id,
        },
        create: {
          userId: target.id,
          permissionId: permission.id,
          effect: override.effect,
          reason: override.reason?.trim() || null,
          createdByUserId: args.actor.id,
        },
      });
    }
  });

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.USER_PERMISSIONS_UPDATED,
    severity: "HIGH",
    userId: target.id,
    actorUserId: args.actor.id,
    message: "User permission overrides updated",
    request: args.request,
    metadata: {
      targetRole: target.role,
      overrides: args.overrides.map((override) => ({
        permissionKey: override.permissionKey,
        effect: override.effect,
      })),
    },
  });

  await recordAdminActivity({
    actorUserId: args.actor.id,
    action: AdminActionType.UPDATE,
    entityType: "UserPermission",
    entityId: target.id,
    message: `Updated permissions for ${target.email}`,
    metadata: {
      overrides: args.overrides.map((override) => ({
        permissionKey: override.permissionKey,
        effect: override.effect,
      })),
    },
  });

  return getEffectivePermissionsForAdminUser(target.id);
}

export async function getEffectivePermissionsForAdminUser(userId: string) {
  const user = await getTargetAdminUser(userId);

  const [rolePermissions, overrides, effectivePermissionKeys] = await Promise.all([
    getRolePermissions(user.role),
    getUserPermissionOverrides(user.id),
    getEffectivePermissionKeysForUser({
      userId: user.id,
      role: user.role,
    }),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    },
    rolePermissions,
    overrides,
    effectivePermissionKeys,
  };
}

export function toPermissionEffect(value: string): PermissionEffect {
  if (value === PermissionEffect.ALLOW) return PermissionEffect.ALLOW;
  if (value === PermissionEffect.DENY) return PermissionEffect.DENY;
  throw new PermissionServiceError("VALIDATION", "Invalid permission effect.");
}

export function isPermissionKey(value: string): value is PermissionKey {
  return SYSTEM_PERMISSION_DEFINITIONS.some((permission) => permission.key === value);
}
