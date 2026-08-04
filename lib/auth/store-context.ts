import { prisma } from "@/lib/db/prisma";
import type { Store, PrismaClient, Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "@/types/domain";

export type StoreActorRelationship = "OWNER";

export interface StoreActorContext {
  storeId: string;
  relationship: StoreActorRelationship;
  permissions: readonly string[];
  storeStatus: string;
  ownerUserId: string;
  staffAuthorizationStatus: "NOT_IMPLEMENTED_IN_CURRENT_SCHEMA";
}

/**
 * Resolves the Store record owned by a given user ID.
 * User.id is distinct from Store.id. Store.ownerUserId links User.id to Store.id.
 */
export async function getStoreForUser(
  userId: string,
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<Store | null> {
  try {
    return await db.store.findFirst({
      where: { ownerUserId: userId },
    });
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
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<Store | null> {
  if (!user || user.role !== "STORE" || user.status !== "ACTIVE") return null;
  return getStoreForUser(user.id, db);
}

/**
 * Resolves canonical store actor context containing store ID, relationship, permissions, and status.
 * Explicitly documents that store staff authorization is NOT_IMPLEMENTED_IN_CURRENT_SCHEMA (deferred to Phase 2).
 */
export async function resolveStoreActorContext(
  user: AuthenticatedUser | null,
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<StoreActorContext | null> {
  if (!user || user.status !== "ACTIVE") return null;

  const store = await getStoreForUser(user.id, db);
  if (!store || !store.ownerUserId) return null;

  return {
    storeId: store.id,
    relationship: "OWNER",
    permissions: ["*"],
    storeStatus: store.status,
    ownerUserId: store.ownerUserId,
    staffAuthorizationStatus: "NOT_IMPLEMENTED_IN_CURRENT_SCHEMA",
  };
}
