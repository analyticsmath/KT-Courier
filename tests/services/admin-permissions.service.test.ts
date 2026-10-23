import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  permission: {
    findMany: vi.fn(),
  },
  rolePermission: {
    findMany: vi.fn(),
  },
  userPermission: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));
const hasPermissionMock = vi.hoisted(() => vi.fn());
const getEffectivePermissionKeysForUserMock = vi.hoisted(() => vi.fn());
const syncSystemPermissionRegistryMock = vi.hoisted(() => vi.fn());
const recordAdminActivityMock = vi.hoisted(() => vi.fn());
const recordSecurityEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/permissions", () => ({
  hasPermission: hasPermissionMock,
  getEffectivePermissionKeysForUser: getEffectivePermissionKeysForUserMock,
  syncSystemPermissions: syncSystemPermissionRegistryMock,
}));
vi.mock("@/lib/services/admin-activity.service", () => ({
  recordAdminActivity: recordAdminActivityMock,
}));
vi.mock("@/lib/services/security-events.service", () => ({
  SECURITY_EVENT_TYPES: {
    PERMISSIONS_SYNCED: "PERMISSIONS_SYNCED",
    ROLE_PERMISSIONS_UPDATED: "ROLE_PERMISSIONS_UPDATED",
    USER_PERMISSIONS_UPDATED: "USER_PERMISSIONS_UPDATED",
    SELF_PERMISSION_CHANGE_BLOCKED: "SELF_PERMISSION_CHANGE_BLOCKED",
    SUPER_ADMIN_PROTECTION_TRIGGERED: "SUPER_ADMIN_PROTECTION_TRIGGERED",
  },
  recordSecurityEvent: recordSecurityEventMock,
}));

import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  PermissionServiceError,
  syncSystemPermissions,
  updateRolePermissions,
  updateUserPermissionOverrides,
} from "@/lib/services/admin-permissions.service";
import { PermissionEffect, UserRole, UserStatus } from "@/types/db";

function targetUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "target-admin",
    email: "target@example.test",
    name: "Target Admin",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    adminProfile: { id: "admin-profile" },
    ...overrides,
  };
}

describe("admin permission service", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    prismaMock.permission.findMany.mockReset();
    prismaMock.rolePermission.findMany.mockReset();
    prismaMock.userPermission.findMany.mockReset();
    prismaMock.$transaction.mockReset();
    hasPermissionMock.mockReset();
    getEffectivePermissionKeysForUserMock.mockReset();
    syncSystemPermissionRegistryMock.mockReset();
    recordAdminActivityMock.mockReset();
    recordSecurityEventMock.mockReset();

    getEffectivePermissionKeysForUserMock.mockResolvedValue([PERMISSIONS.USERS_READ]);
  });

  it("syncs system permissions through the registry and logs the action", async () => {
    syncSystemPermissionRegistryMock.mockResolvedValue({
      permissionsUpserted: 40,
      rolePermissionsUpserted: 12,
    });

    await expect(
      syncSystemPermissions({
        actor: { id: "super-admin", role: UserRole.SUPER_ADMIN },
      })
    ).resolves.toEqual({
      permissionsUpserted: 40,
      rolePermissionsUpserted: 12,
    });

    expect(syncSystemPermissionRegistryMock).toHaveBeenCalledWith({
      actorUserId: "super-admin",
    });
    expect(recordSecurityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "PERMISSIONS_SYNCED" })
    );
  });

  it("rejects system permission sync from normal admins", async () => {
    await expect(
      syncSystemPermissions({
        actor: { id: "admin", role: UserRole.ADMIN },
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<PermissionServiceError>);
  });

  it("rejects invalid role permission keys", async () => {
    prismaMock.permission.findMany.mockResolvedValue([]);

    await expect(
      updateRolePermissions({
        role: UserRole.ADMIN,
        permissionKeys: ["missing.permission"],
        actor: { id: "super-admin", role: UserRole.SUPER_ADMIN },
      })
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("blocks editing SUPER_ADMIN role defaults", async () => {
    await expect(
      updateRolePermissions({
        role: UserRole.SUPER_ADMIN,
        permissionKeys: [PERMISSIONS.USERS_READ],
        actor: { id: "super-admin", role: UserRole.SUPER_ADMIN },
      })
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("logs security events for successful role permission updates", async () => {
    const permission = {
      id: "permission-users-read",
      key: PERMISSIONS.USERS_READ,
      name: "Read users",
      category: "Users",
    };
    const tx = {
      rolePermission: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn().mockResolvedValue({ id: "role-permission" }),
      },
    };
    prismaMock.permission.findMany.mockResolvedValue([permission]);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    prismaMock.rolePermission.findMany.mockResolvedValue([
      {
        id: "role-permission",
        permissionId: permission.id,
        enabled: true,
        permission,
      },
    ]);

    await updateRolePermissions({
      role: UserRole.ADMIN,
      permissionKeys: [PERMISSIONS.USERS_READ],
      actor: { id: "super-admin", role: UserRole.SUPER_ADMIN },
    });

    expect(recordSecurityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ROLE_PERMISSIONS_UPDATED",
        severity: "HIGH",
      })
    );
  });

  it("merges a scoped grant without deleting unrelated permission overrides", async () => {
    const permission = { id: "publish", key: PERMISSIONS.NOTIFICATION_TEMPLATE_PUBLISH, name: "Publish templates", category: "Notifications" };
    prismaMock.user.findUnique.mockResolvedValue(targetUser());
    prismaMock.permission.findMany.mockResolvedValue([permission]);
    prismaMock.rolePermission.findMany.mockResolvedValue([]);
    prismaMock.userPermission.findMany.mockResolvedValue([]);
    const tx = { userPermission: { deleteMany: vi.fn(), upsert: vi.fn().mockResolvedValue({}) } };
    prismaMock.$transaction.mockImplementation(async callback => callback(tx));
    await updateUserPermissionOverrides({ userId: "target-admin", mode: "MERGE", overrides: [{ permissionKey: permission.key, effect: PermissionEffect.ALLOW, reason: "Operator approved reviewer access" }], actor: { id: "super-admin", role: UserRole.SUPER_ADMIN } });
    expect(tx.userPermission.deleteMany).not.toHaveBeenCalled();
    expect(tx.userPermission.upsert).toHaveBeenCalledTimes(1);
    expect(recordSecurityEventMock).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ mode: "MERGE" }) }));
  });

  it.each(["REPLACE", "MERGE"] as const)("rejects self-permission override updates in %s mode", async mode => {
    prismaMock.user.findUnique.mockResolvedValue(targetUser({ id: "admin-1" }));

    await expect(
      updateUserPermissionOverrides({
        mode,
        userId: "admin-1",
        overrides: [],
        actor: { id: "admin-1", role: UserRole.SUPER_ADMIN },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(recordSecurityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SELF_PERMISSION_CHANGE_BLOCKED" })
    );
  });

  it.each(["REPLACE", "MERGE"] as const)("blocks normal admins from modifying SUPER_ADMIN overrides in %s mode", async mode => {
    prismaMock.user.findUnique.mockResolvedValue(
      targetUser({ id: "super-admin", role: UserRole.SUPER_ADMIN })
    );

    await expect(
      updateUserPermissionOverrides({
        mode,
        userId: "super-admin",
        overrides: [
          {
            permissionKey: PERMISSIONS.USERS_READ,
            effect: PermissionEffect.ALLOW,
          },
        ],
        actor: { id: "admin-1", role: UserRole.ADMIN },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(recordSecurityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SUPER_ADMIN_PROTECTION_TRIGGERED" })
    );
  });

  it.each(["REPLACE", "MERGE"] as const)("rejects normal admin overrides without employee permission management in %s mode", async mode => {
    prismaMock.user.findUnique.mockResolvedValue(targetUser());
    hasPermissionMock.mockResolvedValue(false);

    await expect(
      updateUserPermissionOverrides({
        mode,
        userId: "target-admin",
        overrides: [
          {
            permissionKey: PERMISSIONS.USERS_READ,
            effect: PermissionEffect.ALLOW,
          },
        ],
        actor: { id: "admin-1", role: UserRole.ADMIN },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
