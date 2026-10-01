import {
  membershipAllows,
  moduleForPermission,
} from "@/lib/client-platform/store-permissions";
import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_ADMIN_PERMISSION_KEYS,
  ROLE_DEFAULT_PERMISSION_KEYS,
  SYSTEM_PERMISSION_DEFINITIONS,
} from "@/lib/auth/permission-keys";
import { PermissionEffect, UserRole, type Prisma } from "@/types/db";

export class PermissionDeniedError extends Error {
  constructor(message = "Missing required permission.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

type PermissionActor = {
  userId: string;
  role: UserRole;
};

export type HasPermissionArgs = PermissionActor & {
  permissionKey: string;
};

function isAdminRole(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

function isPermissionBearingRole(role: UserRole): boolean {
  return (
    role === UserRole.CUSTOMER ||
    role === UserRole.STORE ||
    role === UserRole.DRIVER ||
    isAdminRole(role) ||
    role === UserRole.PROMOTER
  );
}

async function permissionTableIsEmpty(): Promise<boolean> {
  const count = await prisma.permission.count();
  return count === 0;
}

async function delegatedStoreKeys(
  args: PermissionActor,
): Promise<string[] | null> {
  if (
    ![UserRole.CUSTOMER, UserRole.STORE].includes(
      args.role as "CUSTOMER" | "STORE",
    )
  )
    return null;
  const rows = await prisma.storeEmployeeMembership.findMany({
    where: {
      userId: args.userId,
      status: "ACTIVE",
      store: { status: "ACTIVE" },
    },
    select: { permissions: true },
    take: 2,
  });
  if (!rows.length) return null;
  if (rows.length !== 1) return [];
  return (ROLE_DEFAULT_PERMISSION_KEYS[UserRole.STORE] ?? []).filter((key) =>
    membershipAllows(rows[0].permissions, moduleForPermission(key)),
  );
}

export async function hasPermission(args: HasPermissionArgs): Promise<boolean> {
  if (args.role === UserRole.SUPER_ADMIN) return true;
  if (!isPermissionBearingRole(args.role)) return false;

  if (args.role === UserRole.ADMIN || args.role === UserRole.PROMOTER) {
    if (await permissionTableIsEmpty()) {
      return args.role === UserRole.ADMIN
        ? true
        : (ROLE_DEFAULT_PERMISSION_KEYS[args.role] ?? []).includes(
            args.permissionKey as never,
          );
    }
  }

  const delegated = await delegatedStoreKeys(args);
  const section = moduleForPermission(args.permissionKey);
  if (delegated && section && !delegated.includes(args.permissionKey))
    return false;
  const permission = await prisma.permission.findUnique({
    where: { key: args.permissionKey },
    include: {
      rolePermissions: {
        where: {
          role: args.role,
          enabled: true,
        },
        take: 1,
      },
      userPermissions: {
        where: { userId: args.userId },
        take: 1,
      },
    },
  });

  if (!permission) return !!delegated?.includes(args.permissionKey);

  const override = permission.userPermissions[0];
  if (override?.effect === PermissionEffect.DENY) return false;
  if (override?.effect === PermissionEffect.ALLOW) return true;

  return (
    permission.rolePermissions.length > 0 ||
    !!delegated?.includes(args.permissionKey)
  );
}

export async function requirePermission(
  args: HasPermissionArgs,
): Promise<void> {
  const allowed = await hasPermission(args);
  if (!allowed) throw new PermissionDeniedError();
}

export async function getEffectivePermissionKeysForUser(
  args: PermissionActor,
): Promise<string[]> {
  if (args.role === UserRole.SUPER_ADMIN) {
    const dbPermissions = await prisma.permission.findMany({
      select: { key: true },
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });
    return Array.from(
      new Set([
        ...SYSTEM_PERMISSION_DEFINITIONS.map((permission) => permission.key),
        ...dbPermissions.map((permission) => permission.key),
      ]),
    ).sort();
  }

  if (!isPermissionBearingRole(args.role)) return [];

  if (await permissionTableIsEmpty()) {
    return (
      args.role === UserRole.ADMIN
        ? SYSTEM_PERMISSION_DEFINITIONS.map((permission) => permission.key)
        : (ROLE_DEFAULT_PERMISSION_KEYS[args.role] ?? [])
    )
      .slice()
      .sort();
  }

  const delegated = await delegatedStoreKeys(args);
  const [rolePermissions, overrides] = await Promise.all([
    prisma.rolePermission.findMany({
      where: {
        role: args.role,
        enabled: true,
      },
      include: {
        permission: { select: { key: true } },
      },
    }),
    prisma.userPermission.findMany({
      where: { userId: args.userId },
      include: {
        permission: { select: { key: true } },
      },
    }),
  ]);

  const effective = new Set([
    ...rolePermissions.map((rolePermission) => rolePermission.permission.key),
    ...(delegated ?? []),
  ]);

  for (const override of overrides) {
    if (override.effect === PermissionEffect.DENY) {
      effective.delete(override.permission.key);
    } else {
      effective.add(override.permission.key);
    }
  }

  return Array.from(effective)
    .filter(
      (key) =>
        !delegated || !moduleForPermission(key) || delegated.includes(key),
    )
    .sort();
}

export async function syncSystemPermissions(args: {
  actorUserId: string;
}): Promise<{
  permissionsUpserted: number;
  rolePermissionsUpserted: number;
}> {
  void args.actorUserId;

  return prisma.$transaction(async (tx) => {
    const permissionIdsByKey = new Map<string, string>();
    let permissionsUpserted = 0;

    for (const definition of SYSTEM_PERMISSION_DEFINITIONS) {
      const permission = await tx.permission.upsert({
        where: { key: definition.key },
        update: {
          name: definition.name,
          category: definition.category,
          description: definition.description,
          isSystem: true,
        },
        create: {
          key: definition.key,
          name: definition.name,
          category: definition.category,
          description: definition.description,
          isSystem: true,
        },
      });

      permissionIdsByKey.set(definition.key, permission.id);
      permissionsUpserted += 1;
    }

    let rolePermissionsUpserted = 0;
    for (const [role, permissionKeys] of Object.entries(
      ROLE_DEFAULT_PERMISSION_KEYS,
    ) as [UserRole, typeof DEFAULT_ADMIN_PERMISSION_KEYS][]) {
      for (const permissionKey of permissionKeys) {
        const permissionId = permissionIdsByKey.get(permissionKey);
        if (!permissionId) continue;

        await tx.rolePermission.upsert({
          where: {
            role_permissionId: {
              role,
              permissionId,
            },
          },
          update: { enabled: true },
          create: {
            role,
            permissionId,
            enabled: true,
          },
        });

        rolePermissionsUpserted += 1;
      }
    }

    return { permissionsUpserted, rolePermissionsUpserted };
  });
}

export type PermissionTransaction = Prisma.TransactionClient;
