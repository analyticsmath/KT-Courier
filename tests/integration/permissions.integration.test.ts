import { beforeAll, describe, expect, it } from "vitest";
import { PermissionEffect, UserRole } from "@/types/db";
import { hasPermission, syncSystemPermissions } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { createUser, integrationPrisma, uniqueTag } from "./phase7-5-fixtures";

beforeAll(async () => {
  await syncSystemPermissions({ actorUserId: "system" });
});

describe("Phase 7.5 live permission controls", () => {
  it("applies explicit deny before role grants and keeps non-admin roles out", async () => {
    const admin = await createUser(uniqueTag("permissions-admin"), UserRole.ADMIN);
    const superAdmin = await createUser(uniqueTag("permissions-super"), UserRole.SUPER_ADMIN);
    const customer = await createUser(uniqueTag("permissions-customer"), UserRole.CUSTOMER);
    const driver = await createUser(uniqueTag("permissions-driver"), UserRole.DRIVER);
    const promoter = await createUser(uniqueTag("permissions-promoter"), UserRole.PROMOTER);
    const permission = await integrationPrisma.permission.findUniqueOrThrow({ where: { key: PERMISSIONS.PRICING_MANAGE } });

    await integrationPrisma.rolePermission.upsert({
      where: { role_permissionId: { role: UserRole.ADMIN, permissionId: permission.id } },
      update: { enabled: true },
      create: { role: UserRole.ADMIN, permissionId: permission.id, enabled: true },
    });
    expect(await hasPermission({ userId: admin.id, role: admin.role, permissionKey: PERMISSIONS.PRICING_MANAGE })).toBe(true);
    await integrationPrisma.userPermission.create({ data: { userId: admin.id, permissionId: permission.id, effect: PermissionEffect.DENY, reason: "Phase 7.5 test" } });
    expect(await hasPermission({ userId: admin.id, role: admin.role, permissionKey: PERMISSIONS.PRICING_MANAGE })).toBe(false);
    expect(await hasPermission({ userId: superAdmin.id, role: superAdmin.role, permissionKey: PERMISSIONS.DISPATCH_ASSIGN })).toBe(true);
    for (const actor of [customer, driver, promoter]) {
      expect(await hasPermission({ userId: actor.id, role: actor.role, permissionKey: PERMISSIONS.DISPATCH_ASSIGN })).toBe(false);
      expect(await hasPermission({ userId: actor.id, role: actor.role, permissionKey: PERMISSIONS.PRICING_MANAGE })).toBe(false);
    }
  });
});
