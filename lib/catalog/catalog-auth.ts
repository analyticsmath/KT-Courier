import { storeAccess } from "@/lib/client-platform/store-access";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { DEFAULT_STORE_CATALOG_PERMISSION_KEYS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { catalogJson } from "@/lib/catalog/catalog-api-policy";
import {
  recordSecurityEvent,
  SECURITY_EVENT_TYPES,
} from "@/lib/services/security-events.service";
import { PermissionEffect, UserRole } from "@/types/db";

async function hasPermissionForStoreCatalog(
  userId: string,
  permissionKey: string,
): Promise<boolean> {
  if (
    !DEFAULT_STORE_CATALOG_PERMISSION_KEYS.some((key) => key === permissionKey)
  )
    return false;
  const permissionCount = await prisma.permission.count();
  if (permissionCount === 0) return true;
  const permission = await prisma.permission.findUnique({
    where: { key: permissionKey },
    include: {
      rolePermissions: {
        where: { role: UserRole.STORE, enabled: true },
        take: 1,
      },
      userPermissions: { where: { userId }, take: 1 },
    },
  });
  if (!permission) return false;
  const override = permission.userPermissions[0];
  if (override?.effect === PermissionEffect.DENY) return false;
  if (override?.effect === PermissionEffect.ALLOW) return true;
  return permission.rolePermissions.length > 0;
}

export type StoreCatalogAuth = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  store: { id: string; slug: string; name: string; status: string };
};

export async function requireStoreCatalogPermission(
  permissionKey: string,
  request?: NextRequest,
): Promise<StoreCatalogAuth | { response: ReturnType<typeof catalogJson> }> {
  const user = await getCurrentUser();
  if (!user)
    return {
      response: catalogJson({ error: "Authentication is required." }, 401),
    };
  let store;
  try {
    store = (await storeAccess(user.id, "products")).store;
  } catch {
    return {
      response: catalogJson({ error: "Catalog access is required." }, 403),
    };
  }
  if (store.status !== "ACTIVE")
    return {
      response: catalogJson({ error: "An active business is required." }, 403),
    };
  const allowed = await hasPermissionForStoreCatalog(user.id, permissionKey);
  if (!allowed) {
    await recordSecurityEvent({
      type: SECURITY_EVENT_TYPES.PERMISSION_DENIED,
      severity: "MEDIUM",
      userId: user.id,
      actorUserId: user.id,
      message: "Store catalog permission check denied",
      request,
      metadata: { permissionKey, storeId: store.id },
    });
    return {
      response: catalogJson({ error: "Catalog permission is required." }, 403),
    };
  }
  return { user, store: { ...store, status: String(store.status) } };
}

export async function requireCatalogAdminPermission(
  permissionKey: string,
  request: NextRequest,
) {
  const result = await requireAdminApiPermission(permissionKey, {
    request,
    message: "Catalog administration permission denied",
  });
  if (result.response) return { response: result.response } as const;
  return { user: result.user } as const;
}
