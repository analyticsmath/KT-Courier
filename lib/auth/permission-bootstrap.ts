import { type Prisma, UserRole } from "@/types/db";
import { ROLE_DEFAULT_PERMISSION_KEYS, SYSTEM_PERMISSION_DEFINITIONS } from "./permission-keys";

type PermissionRegistry = Pick<Prisma.TransactionClient, "permission" | "rolePermission">;

/** Add missing canonical defaults; never change user overrides or disabled grants. */
export async function installSystemPermissionDefaults(
  db: PermissionRegistry,
  options: { reenableExistingDefaults?: boolean } = {},
) {
  const permissionIds = new Map<string, string>();
  for (const definition of SYSTEM_PERMISSION_DEFINITIONS) {
    const permission = await db.permission.upsert({
      where: { key: definition.key },
      update: { name: definition.name, category: definition.category, description: definition.description, isSystem: true },
      create: { ...definition, isSystem: true },
    });
    permissionIds.set(definition.key, permission.id);
  }
  let rolePermissionsUpserted = 0;
  for (const [role, keys] of Object.entries(ROLE_DEFAULT_PERMISSION_KEYS) as [UserRole, readonly string[]][]) {
    for (const key of keys) {
      const permissionId = permissionIds.get(key);
      if (!permissionId) throw new Error("A default role permission has no canonical definition.");
      await db.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId } },
        update: options.reenableExistingDefaults ? { enabled: true } : {},
        create: { role, permissionId, enabled: true },
      });
      rolePermissionsUpserted++;
    }
  }
  return { permissionsUpserted: permissionIds.size, rolePermissionsUpserted };
}
