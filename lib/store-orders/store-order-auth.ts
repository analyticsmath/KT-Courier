import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { PermissionEffect, UserRole } from "@/types/db";
import { StoreOrderError } from "@/lib/store-orders/errors";

export const STORE_ORDER_PERMISSION_KEYS = [
  "store_orders.read", "store_orders.review", "store_orders.accept", "store_orders.reject",
  "store_orders.availability", "store_orders.substitutions", "store_orders.prepare", "store_orders.handoff",
] as const;

export type StoreOrderPermission = (typeof STORE_ORDER_PERMISSION_KEYS)[number];
export type StoreOrderActor = Readonly<{ id: string; role: UserRole }>;

async function hasStoreOrderPermission(actor: StoreOrderActor, permissionKey: StoreOrderPermission): Promise<boolean> {
  if (actor.role !== UserRole.STORE) return false;
  const permissionCount = await prisma.permission.count();
  if (permissionCount === 0) return true;
  const permission = await prisma.permission.findUnique({
    where: { key: permissionKey },
    include: { rolePermissions: { where: { role: UserRole.STORE, enabled: true }, take: 1 }, userPermissions: { where: { userId: actor.id }, take: 1 } },
  });
  if (!permission) return false;
  const override = permission.userPermissions[0];
  if (override?.effect === PermissionEffect.DENY) return false;
  if (override?.effect === PermissionEffect.ALLOW) return true;
  return permission.rolePermissions.length > 0;
}

export async function requireStoreOrderActor(input: Readonly<{ actorUserId: string; storeId: string; permission: StoreOrderPermission }>): Promise<void> {
  const actor = await prisma.user.findUnique({ where: { id: input.actorUserId }, select: { id: true, role: true, status: true } });
  if (!actor || actor.role !== UserRole.STORE || actor.status !== "ACTIVE") throw new StoreOrderError("STORE_ORDER_ACCESS_DENIED", "An active store actor is required.");
  const store = await prisma.store.findFirst({ where: { id: input.storeId, ownerUserId: actor.id, status: "ACTIVE" }, select: { id: true } });
  if (!store || !(await hasStoreOrderPermission(actor, input.permission))) throw new StoreOrderError("STORE_ORDER_ACCESS_DENIED", "Store order permission is required.");
}

export async function requireCurrentStoreOrderActor(storeId: string, permission: StoreOrderPermission) {
  const actor = await getCurrentUser();
  if (!actor) throw new StoreOrderError("STORE_ORDER_ACCESS_DENIED", "Authentication is required.");
  await requireStoreOrderActor({ actorUserId: actor.id, storeId, permission });
  return actor;
}
