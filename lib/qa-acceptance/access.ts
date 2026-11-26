import { Prisma, QaAcceptanceRole, QaAcceptanceRunStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveQaAcceptanceLaneConfig } from "./config";

export type ActiveQaPrincipal = Readonly<{
  id: string;
  publicReference: string;
  userId: string;
  role: QaAcceptanceRole;
  storeId: string | null;
  driverProfileId: string | null;
  label: string | null;
}>;

export type QaAcceptanceSessionContext = Readonly<{
  eligible: boolean;
  principal: ActiveQaPrincipal;
  activeRunId: string | null;
  activeRunReference: string | null;
}>;

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function resolveQaPrincipalForUser(
  userId: string | null | undefined,
  db: DbClient = prisma,
): Promise<ActiveQaPrincipal | null> {
  if (!userId) return null;
  const row = await db.qaAcceptancePrincipal.findFirst({
    where: { userId, active: true },
    select: {
      id: true,
      publicReference: true,
      userId: true,
      role: true,
      storeId: true,
      driverProfileId: true,
      label: true,
    },
  });
  return row ? Object.freeze(row) : null;
}

/**
 * Resolves whether an interactive actor is authorized to operate inside the
 * isolated QA Acceptance Lane. Fail-closed: returns null for anonymous,
 * non-enrolled, revoked users, or whenever the QA lane configuration is inactive.
 */
export async function resolveQaAcceptanceSessionContext(
  userId: string | null | undefined,
  db: DbClient = prisma,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<QaAcceptanceSessionContext | null> {
  if (!userId) return null;
  const config = resolveQaAcceptanceLaneConfig(env);
  if (!config.eligible) return null;

  const principal = await resolveQaPrincipalForUser(userId, db);
  if (!principal) return null;

  const activeRun = await db.qaAcceptanceRun.findFirst({
    where: { status: QaAcceptanceRunStatus.ACTIVE },
    orderBy: [{ startedAt: "desc" }],
    select: { id: true, publicReference: true },
  });

  return Object.freeze({
    eligible: true,
    principal,
    activeRunId: activeRun?.id ?? null,
    activeRunReference: activeRun?.publicReference ?? null,
  });
}

/**
 * Returns the store IDs accessible privately inside the QA storefront lane for
 * this authenticated user, or [] when not authorized. Never exposes QA stores
 * to ordinary or anonymous shoppers.
 */
export async function resolveQaVisibleStoreIdsForViewer(
  viewerUserId: string | null | undefined,
  db: DbClient = prisma,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<readonly string[]> {
  if (!viewerUserId) return Object.freeze([]);
  const ctx = await resolveQaAcceptanceSessionContext(viewerUserId, db, env);
  if (!ctx) return Object.freeze([]);

  const stores = await db.store.findMany({
    where: { isQaAcceptance: true },
    select: { id: true },
  });
  return Object.freeze(stores.map((s) => s.id));
}

export async function isStoreVisibleInViewerContext(
  storeId: string,
  viewerUserId: string | null | undefined,
  db: DbClient = prisma,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<{ isQaStore: boolean; allowed: boolean; qaContext: QaAcceptanceSessionContext | null }> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { id: true, isQaAcceptance: true },
  });
  if (!store) {
    return { isQaStore: false, allowed: false, qaContext: null };
  }
  if (!store.isQaAcceptance) {
    return { isQaStore: false, allowed: true, qaContext: null };
  }
  const qaContext = await resolveQaAcceptanceSessionContext(viewerUserId, db, env);
  return {
    isQaStore: true,
    allowed: Boolean(qaContext),
    qaContext,
  };
}

export async function resolveQaApprovalForCheckout(
  checkoutReferenceOrId: string,
  owner?: Readonly<{ type: "CUSTOMER"; userId: string } | { type: "GUEST" }>,
  db: DbClient = prisma,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<{ qaAcceptanceApproved: true } | undefined> {
  if (!resolveQaAcceptanceLaneConfig(env).eligible) return undefined;
  const row = await db.marketplaceCheckout.findFirst({
    where: { OR: [{ publicReference: checkoutReferenceOrId }, { id: checkoutReferenceOrId }] },
    select: { isQaAcceptance: true, customerUserId: true },
  });
  if (!row?.isQaAcceptance) return undefined;
  if (owner) {
    if (owner.type !== "CUSTOMER") return undefined;
    if (row.customerUserId && row.customerUserId !== owner.userId) return undefined;
    const principal = await resolveQaPrincipalForUser(owner.userId, db);
    if (!principal) return undefined;
  }
  return { qaAcceptanceApproved: true };
}
