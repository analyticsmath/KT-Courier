import { type Prisma, UserRole } from "@/types/db";
import { ROLE_DEFAULT_PERMISSION_KEYS, SELF_NOTIFICATION_PERMISSION_KEYS, SYSTEM_PERMISSION_DEFINITIONS } from "./permission-keys";

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

/**
 * Production-safe catalog-only permission repair. No dev/demo users are seeded.
 * Existing disabled STORE grants and per-user DENYs remain unchanged.
 */
export async function installStoreCatalogPermissionDefaults(db: PermissionRegistry) {
  const keys = (ROLE_DEFAULT_PERMISSION_KEYS[UserRole.STORE] ?? [])
    .filter((key) => key.startsWith("catalog."));
  const definitions = new Map(SYSTEM_PERMISSION_DEFINITIONS.map((definition) => [definition.key, definition]));
  for (const key of keys) {
    const definition = definitions.get(key);
    if (!definition) throw new Error(`Missing system permission definition: ${key}`);
    const permission = await db.permission.upsert({
      where: { key },
      update: { name: definition.name, category: definition.category, description: definition.description, isSystem: true },
      create: { ...definition, isSystem: true },
    });
    await db.rolePermission.upsert({
      where: { role_permissionId: { role: UserRole.STORE, permissionId: permission.id } },
      update: {},
      create: { role: UserRole.STORE, permissionId: permission.id, enabled: true },
    });
  }
  return { permissionsUpserted: keys.length, rolePermissionsUpserted: keys.length };
}

/** Backfill missing own-inbox defaults on upgraded production databases. */
export async function installSelfNotificationPermissionDefaults(db: PermissionRegistry) {
  let grants = 0;
  for (const key of SELF_NOTIFICATION_PERMISSION_KEYS) {
    const definition = SYSTEM_PERMISSION_DEFINITIONS.find(item => item.key === key);
    if (!definition) throw new Error("Missing notification permission definition.");
    const permission = await db.permission.upsert({
      where: { key },
      update: {},
      create: { ...definition, isSystem: true },
    });
    for (const [role, defaults] of Object.entries(ROLE_DEFAULT_PERMISSION_KEYS)) {
      if (!defaults.includes(key)) continue;
      await db.rolePermission.upsert({
        where: { role_permissionId: { role: role as UserRole, permissionId: permission.id } },
        update: {},
        create: { role: role as UserRole, permissionId: permission.id, enabled: true },
      });
      grants++;
    }
  }
  return { permissionsUpserted: SELF_NOTIFICATION_PERMISSION_KEYS.length, rolePermissionsUpserted: grants };
}
