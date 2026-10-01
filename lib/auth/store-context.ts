import { prisma } from "@/lib/db/prisma";
import type { Store, PrismaClient, Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "@/types/domain";

export type StoreActorRelationship = "OWNER" | "EMPLOYEE";

export interface StoreActorContext {
  storeId: string;
  relationship: StoreActorRelationship;
  permissions: readonly string[];
  storeStatus: string;
  ownerUserId: string;
  staffAuthorizationStatus: "ENFORCED";
}

/**
 * Resolves the Store record owned by a given user ID.
 * User.id is distinct from Store.id. Store.ownerUserId links User.id to Store.id.
 */
export async function getStoreForUser(
  userId: string,
  db: PrismaClient | Prisma.TransactionClient = prisma,
  section?: import("@/lib/client-platform/store-permissions").StoreModule,
): Promise<Store | null> {
  try {
    const owned = await db.store.findMany({
      where: { ownerUserId: userId },
      take: 2,
    });
    if (owned.length) return owned.length === 1 ? owned[0] : null;
    if (!section) return null;
    const rows = await db.storeEmployeeMembership.findMany({
      where: { userId, status: "ACTIVE", store: { status: "ACTIVE" } },
      include: { store: true },
      take: 2,
    });
    return rows.length === 1 &&
      Array.isArray(rows[0].permissions) &&
      rows[0].permissions.includes(section)
      ? rows[0].store
      : null;
  } catch {
    return null;
  }
}

/**
 * Resolves active store context for an authenticated user.
 * Returns null if user is not a STORE account or has no associated store.
 */
export async function resolveStoreContext(
  user: AuthenticatedUser | null,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Store | null> {
  if (!user || user.role !== "STORE" || user.status !== "ACTIVE") return null;
  return getStoreForUser(user.id, db);
}

/**
 * Resolves canonical store actor context containing store ID, relationship, permissions, and status.
 * Staff authorization uses the active membership without changing the actor identity.
 */
export async function resolveStoreActorContext(
  user: AuthenticatedUser | null,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<StoreActorContext | null> {
  if (!user || user.status !== "ACTIVE") return null;

  const owned = await getStoreForUser(user.id, db);
  const memberships = owned
    ? []
    : await db.storeEmployeeMembership.findMany({
        where: {
          userId: user.id,
          status: "ACTIVE",
          store: { status: "ACTIVE" },
        },
        include: { store: true },
        take: 2,
      });
  const store =
    owned ?? (memberships.length === 1 ? memberships[0].store : null);
  if (!store || !store.ownerUserId) return null;

  return {
    storeId: store.id,
    relationship: store.ownerUserId === user.id ? "OWNER" : "EMPLOYEE",
    permissions:
      store.ownerUserId === user.id
        ? ["*"]
        : (((
            await db.storeEmployeeMembership.findFirst({
              where: { storeId: store.id, userId: user.id, status: "ACTIVE" },
              select: { permissions: true },
            })
          )?.permissions as string[]) ?? []),
    storeStatus: store.status,
    ownerUserId: store.ownerUserId,
    staffAuthorizationStatus: "ENFORCED",
  };
}
