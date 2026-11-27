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

function isPrincipalRoleCompatibleWithUserRole(
  principalRole: QaAcceptanceRole,
  userRole: string,
): boolean {
  switch (principalRole) {
    case "ADMIN":
      return userRole === "ADMIN" || userRole === "SUPER_ADMIN";
    case "CUSTOMER":
      return userRole === "CUSTOMER";
    case "VENDOR":
      return userRole === "STORE";
    case "DRIVER":
      return userRole === "DRIVER";
    default:
      return false;
  }
}

export async function resolveQaPrincipalForUser(
  userId: string | null | undefined,
  db: DbClient = prisma,
): Promise<ActiveQaPrincipal | null> {
  if (!userId) return null;
  const row = await db.qaAcceptancePrincipal.findFirst({
    where: { userId, active: true, revokedAt: null },
    select: {
      id: true,
      publicReference: true,
      userId: true,
      role: true,
      storeId: true,
      driverProfileId: true,
      label: true,
      user: { select: { status: true, role: true, isQaAcceptance: true } },
      store: { select: { id: true, isQaAcceptance: true } },
      driverProfile: { select: { id: true, isQaAcceptance: true } },
    },
  });
  if (!row) return null;

  if (row.user) {
    if (
      row.user.status !== "ACTIVE" ||
      row.user.isQaAcceptance !== true ||
      !isPrincipalRoleCompatibleWithUserRole(row.role, row.user.role)
    ) {
      return null;
    }
  }
  if (row.role === "VENDOR") {
    if (!row.storeId) return null;
    if (row.store && (row.store.id !== row.storeId || row.store.isQaAcceptance !== true)) {
      return null;
    }
  }
  if (row.role === "DRIVER") {
    if (!row.driverProfileId) return null;
    if (
      row.driverProfile &&
      (row.driverProfile.id !== row.driverProfileId || row.driverProfile.isQaAcceptance !== true)
    ) {
      return null;
    }
  }

  return Object.freeze({
    id: row.id,
    publicReference: row.publicReference,
    userId: row.userId,
    role: row.role,
    storeId: row.storeId,
    driverProfileId: row.driverProfileId,
    label: row.label,
  });
}

type ActiveQaRunRow = Readonly<{
  id: string;
  publicReference: string;
  storeId: string | null;
  customerUserId: string | null;
  driverProfileId: string | null;
  startedAt: Date;
}>;

function scoreActiveRunForPrincipal(
  run: ActiveQaRunRow,
  principal: ActiveQaPrincipal,
): number {
  switch (principal.role) {
    case "CUSTOMER":
      if (run.customerUserId && run.customerUserId !== principal.userId) return -1;
      return run.customerUserId === principal.userId ? 3 : 1;
    case "VENDOR":
      if (!principal.storeId) return -1;
      if (run.storeId && run.storeId !== principal.storeId) return -1;
      return run.storeId === principal.storeId ? 3 : 1;
    case "DRIVER":
      if (!principal.driverProfileId) return -1;
      if (run.driverProfileId && run.driverProfileId !== principal.driverProfileId) return -1;
      return run.driverProfileId === principal.driverProfileId ? 3 : 1;
    case "ADMIN":
      return 1;
    default:
      return -1;
  }
}

async function listActiveRuns(db: DbClient): Promise<ActiveQaRunRow[]> {
  if (typeof (db as { qaAcceptanceRun?: { findMany?: unknown } })?.qaAcceptanceRun?.findMany === "function") {
    return db.qaAcceptanceRun.findMany({
      where: { status: QaAcceptanceRunStatus.ACTIVE },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        publicReference: true,
        storeId: true,
        customerUserId: true,
        driverProfileId: true,
        startedAt: true,
      },
    });
  }
  const single = await db.qaAcceptanceRun.findFirst({
    where: { status: QaAcceptanceRunStatus.ACTIVE },
    orderBy: [{ startedAt: "desc" }],
    select: { id: true, publicReference: true },
  });
  return single
    ? [{ ...single, storeId: null, customerUserId: null, driverProfileId: null, startedAt: new Date(0) }]
    : [];
}

function selectRunForPrincipal(
  runs: readonly ActiveQaRunRow[],
  principal: ActiveQaPrincipal,
): ActiveQaRunRow | null {
  let best: ActiveQaRunRow | null = null;
  let bestScore = -1;
  for (const run of runs) {
    const score = scoreActiveRunForPrincipal(run, principal);
    if (score < 0) continue;
    if (score > bestScore) {
      best = run;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Resolves whether an interactive actor is authorized to operate inside the
 * isolated QA Acceptance Lane. Fail-closed: returns null for anonymous,
 * non-enrolled, revoked users, mismatched participants, archived/completed runs,
 * or whenever the QA lane configuration is inactive.
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

  const activeRuns = await listActiveRuns(db);
  const activeRun = selectRunForPrincipal(activeRuns, principal);
  if (!activeRun) return null;

  return Object.freeze({
    eligible: true,
    principal,
    activeRunId: activeRun.id,
    activeRunReference: activeRun.publicReference,
  });
}

/**
 * Returns the store IDs accessible privately inside the QA storefront lane for
 * this authenticated user, scoped strictly to their matching active QA run.
 * Never exposes QA stores to ordinary, revoked, or archived-run users.
 */
export async function resolveQaVisibleStoreIdsForViewer(
  viewerUserId: string | null | undefined,
  db: DbClient = prisma,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<readonly string[]> {
  if (!viewerUserId) return Object.freeze([]);
  const ctx = await resolveQaAcceptanceSessionContext(viewerUserId, db, env);
  if (!ctx || !ctx.activeRunId) return Object.freeze([]);

  const [activeRuns, qaStores] = await Promise.all([
    listActiveRuns(db),
    db.store.findMany({
      where: { isQaAcceptance: true },
      select: { id: true },
    }),
  ]);
  const qaStoreSet = new Set(qaStores.map((s) => s.id));
  if (qaStoreSet.size === 0) return Object.freeze([]);

  if (ctx.principal.role === "VENDOR") {
    return Object.freeze(
      ctx.principal.storeId && qaStoreSet.has(ctx.principal.storeId) ? [ctx.principal.storeId] : [],
    );
  }

  const matchedRun = activeRuns.find((run) => run.id === ctx.activeRunId);
  if (!matchedRun) return Object.freeze([]);

  if (matchedRun.storeId) {
    return Object.freeze(qaStoreSet.has(matchedRun.storeId) ? [matchedRun.storeId] : []);
  }

  // Unbound-store active run: allow QA stores that are not exclusively bound to
  // another customer's active run.
  const storesBoundToOtherRuns = new Set(
    activeRuns
      .filter(
        (run) =>
          run.id !== matchedRun.id &&
          Boolean(run.storeId) &&
          (ctx.principal.role === "CUSTOMER"
            ? run.customerUserId !== ctx.principal.userId
            : ctx.principal.role === "DRIVER"
              ? run.driverProfileId !== ctx.principal.driverProfileId
              : false),
      )
      .map((run) => run.storeId as string),
  );

  return Object.freeze(
    qaStores.map((s) => s.id).filter((id) => !storesBoundToOtherRuns.has(id)),
  );
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
  if (!qaContext) {
    return { isQaStore: true, allowed: false, qaContext: null };
  }
  const visibleStoreIds = await resolveQaVisibleStoreIdsForViewer(viewerUserId, db, env);
  return {
    isQaStore: true,
    allowed: visibleStoreIds.includes(store.id),
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
    select: { isQaAcceptance: true, qaAcceptanceRunId: true, customerUserId: true },
  });
  if (!row?.isQaAcceptance) return undefined;
  if (owner) {
    if (owner.type !== "CUSTOMER") return undefined;
    if (row.customerUserId && row.customerUserId !== owner.userId) return undefined;
    const qaCtx = await resolveQaAcceptanceSessionContext(owner.userId, db, env);
    if (!qaCtx) return undefined;
    if (row.qaAcceptanceRunId && qaCtx.activeRunId !== row.qaAcceptanceRunId) return undefined;
  }
  return { qaAcceptanceApproved: true };
}

export async function checkOrderDriverQaScope(
  db: DbClient,
  input: Readonly<{
    orderId: string;
    driverProfileId: string;
  }>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [order, driver] = await Promise.all([
    db.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, isQaAcceptance: true, qaAcceptanceRunId: true },
    }),
    db.driverProfile.findUnique({
      where: { id: input.driverProfileId },
      select: {
        id: true,
        isQaAcceptance: true,
        userId: true,
        user: { select: { status: true, role: true, isQaAcceptance: true } },
      },
    }),
  ]);

  if (!order) return { ok: false, reason: "Order not found." };
  if (!driver) return { ok: false, reason: "Driver profile not found." };

  const orderIsQa = Boolean(order.isQaAcceptance);
  const driverIsQa = Boolean(driver.isQaAcceptance);

  if (orderIsQa !== driverIsQa) {
    return {
      ok: false,
      reason: orderIsQa
        ? "QA acceptance orders can only be dispatched to an enrolled QA acceptance driver."
        : "QA acceptance drivers cannot be dispatched to live commercial orders.",
    };
  }

  if (!orderIsQa) {
    return { ok: true };
  }

  const principal = await resolveQaPrincipalForUser(driver.userId, db);
  if (
    !principal ||
    principal.role !== QaAcceptanceRole.DRIVER ||
    principal.driverProfileId !== driver.id
  ) {
    return {
      ok: false,
      reason: "QA driver enrollment is inactive, revoked, or mismatched.",
    };
  }

  const activeRuns = await listActiveRuns(db);
  if (order.qaAcceptanceRunId) {
    const orderRun = await db.qaAcceptanceRun.findUnique({
      where: { id: order.qaAcceptanceRunId },
      select: { id: true, status: true, driverProfileId: true },
    });
    if (!orderRun) {
      return { ok: false, reason: "QA order references an unknown QA acceptance run." };
    }
    if (orderRun.status !== QaAcceptanceRunStatus.ACTIVE) {
      return {
        ok: false,
        reason: `Cannot dispatch QA order from ${orderRun.status.toLowerCase()} QA acceptance run.`,
      };
    }
    if (orderRun.driverProfileId && orderRun.driverProfileId !== driver.id) {
      return {
        ok: false,
        reason: "Selected QA driver belongs to a different QA acceptance run.",
      };
    }
    const driverBoundActiveRuns = activeRuns.filter((run) => run.driverProfileId === driver.id);
    if (
      !orderRun.driverProfileId &&
      driverBoundActiveRuns.length > 0 &&
      !driverBoundActiveRuns.some((run) => run.id === orderRun.id)
    ) {
      return {
        ok: false,
        reason: "Selected QA driver is exclusively bound to a different active QA acceptance run.",
      };
    }
  } else {
    const driverSession = selectRunForPrincipal(activeRuns, principal);
    if (!driverSession) {
      return {
        ok: false,
        reason: "QA driver has no active QA acceptance run for dispatch.",
      };
    }
  }

  return { ok: true };
}
