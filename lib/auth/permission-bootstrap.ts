import { type Prisma, UserRole } from "@/types/db";
import { ROLE_DEFAULT_PERMISSION_KEYS, SYSTEM_PERMISSION_DEFINITIONS } from "./permission-keys";

type PermissionRegistry = Pick<Prisma.TransactionClient, "permission" | "rolePermission">;

async function inBoundedBatches<T>(items: readonly T[], work: (item: T) => Promise<void>) {
  // Bootstrap has hundreds of independent upserts. Bound concurrency instead
  // of serial network round trips; interactive transactions still use their
  // single connection. No existing disabled grant or override is changed.
  for (let offset = 0; offset < items.length; offset += 16) {
    await Promise.all(items.slice(offset, offset + 16).map(work));
  }
}

/** Add missing canonical defaults; never change user overrides or disabled grants. */
export async function installSystemPermissionDefaults(
  db: PermissionRegistry,
  options: { reenableExistingDefaults?: boolean } = {},
) {
  const permissionIds = new Map<string, string>();
  await inBoundedBatches(SYSTEM_PERMISSION_DEFINITIONS, async definition => {
    const permission = await db.permission.upsert({
      where: { key: definition.key },
      update: { name: definition.name, category: definition.category, description: definition.description, isSystem: true },
      create: { ...definition, isSystem: true },
    });
    permissionIds.set(definition.key, permission.id);
  });
  let rolePermissionsUpserted = 0;
  const grants = (Object.entries(ROLE_DEFAULT_PERMISSION_KEYS) as [UserRole, readonly string[]][]).flatMap(([role, keys]) => keys.map(key => ({ role, key })));
  await inBoundedBatches(grants, async ({ role, key }) => {
    const permissionId = permissionIds.get(key);
    if (!permissionId) throw new Error("A default role permission has no canonical definition.");
    await db.rolePermission.upsert({
      where: { role_permissionId: { role, permissionId } },
      update: options.reenableExistingDefaults ? { enabled: true } : {},
      create: { role, permissionId, enabled: true },
    });
    rolePermissionsUpserted++;
  });
  return { permissionsUpserted: permissionIds.size, rolePermissionsUpserted };
}
