import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  permission: {
    count: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  rolePermission: {
    findMany: vi.fn(),
  },
  userPermission: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  PERMISSIONS,
  ROLE_DEFAULT_PERMISSION_KEYS,
  SYSTEM_PERMISSION_DEFINITIONS,
} from "@/lib/auth/permission-keys";
import {
  getEffectivePermissionKeysForUser,
  hasPermission,
  syncSystemPermissions,
} from "@/lib/auth/permissions";
import { PermissionEffect, UserRole } from "@/types/db";

function permissionRecord(args?: {
  rolePermissions?: unknown[];
  userPermissions?: unknown[];
}) {
  return {
    id: "permission-id",
    key: PERMISSIONS.USERS_READ,
    rolePermissions: args?.rolePermissions ?? [],
    userPermissions: args?.userPermissions ?? [],
  };
}

describe("permission evaluation", () => {
  beforeEach(() => {
    prismaMock.permission.count.mockReset();
    prismaMock.permission.findUnique.mockReset();
    prismaMock.permission.findMany.mockReset();
    prismaMock.permission.upsert.mockReset();
    prismaMock.rolePermission.findMany.mockReset();
    prismaMock.userPermission.findMany.mockReset();
    prismaMock.$transaction.mockReset();
  });

  it("allows SUPER_ADMIN for any permission", async () => {
    await expect(
      hasPermission({
        userId: "super-admin",
        role: UserRole.SUPER_ADMIN,
        permissionKey: "unknown.permission",
      })
    ).resolves.toBe(true);

    expect(prismaMock.permission.count).not.toHaveBeenCalled();
  });

  it("denies customer, store, and driver roles for admin permissions", async () => {
    for (const role of [UserRole.CUSTOMER, UserRole.STORE, UserRole.DRIVER]) {
      await expect(
        hasPermission({
          userId: `user-${role}`,
          role,
          permissionKey: PERMISSIONS.ADMIN_DASHBOARD_READ,
        })
      ).resolves.toBe(false);
    }

    expect(prismaMock.permission.count).not.toHaveBeenCalled();
  });

  it("allows ADMIN through legacy fallback when the permission table is empty", async () => {
    prismaMock.permission.count.mockResolvedValue(0);

    await expect(
      hasPermission({
        userId: "admin",
        role: UserRole.ADMIN,
        permissionKey: PERMISSIONS.SETTINGS_UPDATE,
      })
    ).resolves.toBe(true);
  });

  it("denies ADMIN when permissions exist but no grant exists", async () => {
    prismaMock.permission.count.mockResolvedValue(1);
    prismaMock.permission.findUnique.mockResolvedValue(permissionRecord());

    await expect(
      hasPermission({
        userId: "admin",
        role: UserRole.ADMIN,
        permissionKey: PERMISSIONS.USERS_READ,
      })
    ).resolves.toBe(false);
  });

  it("allows enabled role permission grants", async () => {
    prismaMock.permission.count.mockResolvedValue(1);
    prismaMock.permission.findUnique.mockResolvedValue(
      permissionRecord({ rolePermissions: [{ id: "role-grant" }] })
    );

    await expect(
      hasPermission({
        userId: "admin",
        role: UserRole.ADMIN,
        permissionKey: PERMISSIONS.USERS_READ,
      })
    ).resolves.toBe(true);
  });

  it("allows explicit user ALLOW grants", async () => {
    prismaMock.permission.count.mockResolvedValue(1);
    prismaMock.permission.findUnique.mockResolvedValue(
      permissionRecord({
        userPermissions: [{ effect: PermissionEffect.ALLOW }],
      })
    );

    await expect(
      hasPermission({
        userId: "admin",
        role: UserRole.ADMIN,
        permissionKey: PERMISSIONS.USERS_READ,
      })
    ).resolves.toBe(true);
  });

  it("denies explicit user DENY overrides", async () => {
    prismaMock.permission.count.mockResolvedValue(1);
    prismaMock.permission.findUnique.mockResolvedValue(
      permissionRecord({
        rolePermissions: [{ id: "role-grant" }],
        userPermissions: [{ effect: PermissionEffect.DENY }],
      })
    );

    await expect(
      hasPermission({
        userId: "admin",
        role: UserRole.ADMIN,
        permissionKey: PERMISSIONS.USERS_READ,
      })
    ).resolves.toBe(false);
  });

  it("denies unknown permission keys", async () => {
    prismaMock.permission.count.mockResolvedValue(1);
    prismaMock.permission.findUnique.mockResolvedValue(null);

    await expect(
      hasPermission({
        userId: "admin",
        role: UserRole.ADMIN,
        permissionKey: "unknown.permission",
      })
    ).resolves.toBe(false);
  });

  it("returns combined effective permissions and excludes denied permissions", async () => {
    prismaMock.permission.count.mockResolvedValue(1);
    prismaMock.rolePermission.findMany.mockResolvedValue([
      { permission: { key: PERMISSIONS.USERS_READ } },
      { permission: { key: PERMISSIONS.STORES_READ } },
    ]);
    prismaMock.userPermission.findMany.mockResolvedValue([
      {
        effect: PermissionEffect.ALLOW,
        permission: { key: PERMISSIONS.ORDERS_READ },
      },
      {
        effect: PermissionEffect.DENY,
        permission: { key: PERMISSIONS.STORES_READ },
      },
    ]);

    await expect(
      getEffectivePermissionKeysForUser({
        userId: "admin",
        role: UserRole.ADMIN,
      })
    ).resolves.toEqual([
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.USERS_READ,
    ]);
  });

  it("returns all system and database permissions for SUPER_ADMIN", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      { key: "custom.permission" },
      { key: PERMISSIONS.USERS_READ },
    ]);

    const keys = await getEffectivePermissionKeysForUser({
      userId: "super-admin",
      role: UserRole.SUPER_ADMIN,
    });

    expect(keys).toContain(PERMISSIONS.USERS_READ);
    expect(keys).toContain("custom.permission");
    expect(keys).toContain(PERMISSIONS.EMPLOYEES_PERMISSIONS_MANAGE);
  });

  it("syncs system permissions and default role grants with upserts", async () => {
    const tx = {
      permission: {
        upsert: vi.fn(({ where }: { where: { key: string } }) =>
          Promise.resolve({ id: `id:${where.key}`, key: where.key })
        ),
      },
      rolePermission: {
        upsert: vi.fn(() => Promise.resolve({ id: "role-permission-id" })),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    const totalRolePermissions = Object.values(ROLE_DEFAULT_PERMISSION_KEYS).flat().length;

    await expect(
      syncSystemPermissions({ actorUserId: "super-admin" })
    ).resolves.toEqual({
      permissionsUpserted: SYSTEM_PERMISSION_DEFINITIONS.length,
      rolePermissionsUpserted: totalRolePermissions,
    });

    await syncSystemPermissions({ actorUserId: "super-admin" });

    expect(tx.permission.upsert).toHaveBeenCalledTimes(
      SYSTEM_PERMISSION_DEFINITIONS.length * 2
    );
    expect(tx.rolePermission.upsert).toHaveBeenCalledTimes(
      totalRolePermissions * 2
    );
  });
});
