import { randomUUID } from "node:crypto";
import { Prisma, QaAcceptanceRole, QaAcceptanceRunStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { resolveQaAcceptanceLaneConfig } from "./config";
import { ensureOwnerWalletIsolatedForQaInTx, ensureQaPlatformSandboxAccountsInTx } from "./ledger";

export class QaAcceptanceError extends Error {
  constructor(
    readonly code:
      | "QA_INVALID_INPUT"
      | "QA_NOT_FOUND"
      | "QA_CONFLICT"
      | "QA_CONFIG_UNAVAILABLE"
      | "QA_ISOLATION_VIOLATION",
    message: string,
  ) {
    super(message);
    this.name = "QaAcceptanceError";
  }
}

function newRef(prefix: string): string {
  return `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export async function getQaAcceptanceDashboard(searchQuery?: string) {
  const config = resolveQaAcceptanceLaneConfig();
  const q = searchQuery?.trim() ?? "";

  const [
    principals,
    runs,
    rawCandidateStores,
    rawCandidateUsers,
    activeStats,
    sandboxAccounts,
  ] = await Promise.all([
    prisma.qaAcceptancePrincipal.findMany({
      orderBy: [{ active: "desc" }, { enrolledAt: "desc" }],
      include: {
        user: { select: { id: true, email: true, name: true, role: true, status: true, isQaAcceptance: true } },
        store: { select: { id: true, name: true, slug: true, status: true, isQaAcceptance: true } },
        driverProfile: { select: { id: true, driverCode: true, status: true, onboardingStatus: true, isQaAcceptance: true } },
      },
    }),
    prisma.qaAcceptanceRun.findMany({
      orderBy: [{ startedAt: "desc" }],
      take: 20,
      include: {
        store: { select: { id: true, name: true, slug: true } },
        customerUser: { select: { id: true, email: true, name: true } },
        driverProfile: { select: { id: true, driverCode: true, user: { select: { email: true, name: true } } } },
        _count: {
          select: {
            orders: true,
            payments: true,
            marketplaceCheckouts: true,
            marketplaceOrders: true,
            marketplaceStoreOrders: true,
          },
        },
      },
    }),
    prisma.store.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { ownerUser: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined,
      orderBy: [{ isQaAcceptance: "desc" }, { createdAt: "desc" }],
      take: 25,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        isQaAcceptance: true,
        ownerUser: { select: { id: true, email: true, name: true, role: true } },
      },
    }),
    prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {
            OR: [
              { isQaAcceptance: true },
              { email: { contains: "kaventra", mode: "insensitive" } },
              { email: { contains: "@ktcouriers.local", mode: "insensitive" } },
              { email: { contains: "@example.co.za", mode: "insensitive" } },
            ],
          },
      orderBy: [{ isQaAcceptance: "desc" }, { createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isQaAcceptance: true,
        ownedStores: { select: { id: true, name: true, slug: true }, take: 5 },
        driverProfile: { select: { id: true, driverCode: true, status: true, onboardingStatus: true } },
      },
    }),
    Promise.all([
      prisma.order.count({ where: { isQaAcceptance: true } }),
      prisma.marketplaceOrder.count({ where: { isQaAcceptance: true } }),
      prisma.payment.count({ where: { isQaAcceptance: true, status: "SUCCEEDED" } }),
      prisma.storeEarning.count({ where: { isQaAcceptance: true } }),
      prisma.driverEarning.count({ where: { isQaAcceptance: true } }),
      prisma.commissionAccrual.count({ where: { isQaAcceptance: true } }),
      prisma.cashOnDelivery.count({ where: { isQaAcceptance: true } }),
      prisma.shipmentDocument.count({ where: { order: { isQaAcceptance: true } } }),
    ]),
    prisma.wallet.findMany({
      where: {
        OR: [
          { isQaIsolated: true },
          { ownerType: "PLATFORM", ownerId: "platform-sandbox-acceptance" },
        ],
      },
      include: {
        accounts: {
          orderBy: { code: "asc" },
          select: { id: true, code: true, purpose: true, category: true, currentBalance: true, debitTotal: true, creditTotal: true },
        },
      },
    }),
  ]);

  const [
    qaOrderCount,
    qaMarketplaceOrderCount,
    qaSucceededPaymentCount,
    qaStoreEarningCount,
    qaDriverEarningCount,
    qaCommissionCount,
    qaCodCount,
    qaShipmentDocCount,
  ] = activeStats;

  const candidateStores = rawCandidateStores
    .filter((s): s is typeof s & { ownerUser: NonNullable<typeof s.ownerUser> } => Boolean(s.ownerUser))
    .map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status,
      isQaAcceptance: s.isQaAcceptance,
      owner: s.ownerUser,
    }));

  const candidateUsers = rawCandidateUsers.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    isQaAcceptance: u.isQaAcceptance,
    store: u.ownedStores[0] ?? null,
    driverProfile: u.driverProfile,
  }));

  return Object.freeze({
    config: {
      eligible: config.eligible,
      laneFlagEnabled: config.laneFlagEnabled,
      acceptanceSandboxFlagEnabled: config.acceptanceSandboxFlagEnabled,
      secretSource: config.secretSource,
      secretConfigured: config.secretConfigured,
      publicKeyConfigured: config.publicKeyConfigured,
      reason: config.reason,
      credentialVersion: config.credentialVersion,
      releaseSha: config.releaseSha,
    },
    principals,
    runs,
    candidates: {
      stores: candidateStores,
      users: candidateUsers,
    },
    reconciliation: {
      qaOrderCount,
      qaMarketplaceOrderCount,
      qaSucceededPaymentCount,
      qaStoreEarningCount,
      qaDriverEarningCount,
      qaCommissionCount,
      qaCodCount,
      qaShipmentDocCount,
      isolatedWallets: sandboxAccounts.map((w) => ({
        id: w.id,
        ownerType: w.ownerType,
        ownerId: w.ownerId,
        isQaIsolated: w.isQaIsolated,
        accounts: w.accounts.map((a) => ({
          id: a.id,
          code: a.code,
          purpose: a.purpose,
          category: a.category,
          currentBalance: a.currentBalance.toFixed(2),
          debitTotal: a.debitTotal.toFixed(2),
          creditTotal: a.creditTotal.toFixed(2),
        })),
      })),
    },
  });
}

export async function enrollQaAcceptancePrincipal(input: Readonly<{
  actorUserId: string;
  userIdentifier: string;
  role: QaAcceptanceRole;
  storeIdentifier?: string;
  label?: string;
  notes?: string;
}>) {
  const identifier = input.userIdentifier.trim();
  if (!identifier) {
    throw new QaAcceptanceError("QA_INVALID_INPUT", "User email or ID is required.");
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: identifier }, { email: identifier.toLowerCase() }],
    },
    include: {
      ownedStores: { select: { id: true, name: true, slug: true }, take: 5 },
      driverProfile: { select: { id: true, driverCode: true } },
    },
  });

  if (!user) {
    throw new QaAcceptanceError("QA_NOT_FOUND", `Account not found for identifier '${identifier}'.`);
  }

  let resolvedStoreId: string | null = null;
  if (input.role === "VENDOR") {
    const storeIdent = input.storeIdentifier?.trim();
    if (storeIdent) {
      const store = await prisma.store.findFirst({
        where: { OR: [{ id: storeIdent }, { slug: storeIdent }, { name: { equals: storeIdent, mode: "insensitive" } }] },
        select: { id: true, ownerUserId: true },
      });
      if (!store) {
        throw new QaAcceptanceError("QA_NOT_FOUND", `Store not found for '${storeIdent}'.`);
      }
      if (store.ownerUserId !== user.id) {
        throw new QaAcceptanceError("QA_INVALID_INPUT", "Selected user is not the owner of the specified store.");
      }
      resolvedStoreId = store.id;
    } else if (user.ownedStores[0]?.id) {
      resolvedStoreId = user.ownedStores[0].id;
    } else {
      throw new QaAcceptanceError("QA_INVALID_INPUT", "Vendor principal requires a store record.");
    }
  }

  let resolvedDriverProfileId: string | null = null;
  if (input.role === "DRIVER") {
    if (!user.driverProfile?.id) {
      throw new QaAcceptanceError("QA_INVALID_INPUT", "Driver principal requires an existing DriverProfile.");
    }
    resolvedDriverProfileId = user.driverProfile.id;
  }

  const principal = await prisma.$transaction(
    async (tx) => {
      await ensureQaPlatformSandboxAccountsInTx(tx);

      if (resolvedStoreId) {
        await ensureOwnerWalletIsolatedForQaInTx(tx, {
          ownerType: "STORE",
          ownerId: resolvedStoreId,
        });
        await tx.store.update({
          where: { id: resolvedStoreId },
          data: { isQaAcceptance: true },
        });
      }

      if (resolvedDriverProfileId) {
        await ensureOwnerWalletIsolatedForQaInTx(tx, {
          ownerType: "DRIVER",
          ownerId: resolvedDriverProfileId,
        });
        await tx.driverProfile.update({
          where: { id: resolvedDriverProfileId },
          data: { isQaAcceptance: true },
        });
      }

      if (input.role === "CUSTOMER") {
        await ensureOwnerWalletIsolatedForQaInTx(tx, {
          ownerType: "CUSTOMER",
          ownerId: user.id,
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: { isQaAcceptance: true },
      });

      const existing = await tx.qaAcceptancePrincipal.findUnique({
        where: { userId: user.id },
      });

      if (existing) {
        return tx.qaAcceptancePrincipal.update({
          where: { id: existing.id },
          data: {
            role: input.role,
            storeId: resolvedStoreId,
            driverProfileId: resolvedDriverProfileId,
            active: true,
            label: input.label?.trim() || existing.label || user.name || user.email,
            notes: input.notes?.trim() ?? existing.notes,
            enrolledByUserId: input.actorUserId,
            enrolledAt: new Date(),
            revokedByUserId: null,
            revokedAt: null,
            revokeReason: null,
          },
        });
      }

      return tx.qaAcceptancePrincipal.create({
        data: {
          publicReference: newRef("QAP"),
          userId: user.id,
          role: input.role,
          storeId: resolvedStoreId,
          driverProfileId: resolvedDriverProfileId,
          active: true,
          label: input.label?.trim() || user.name || user.email,
          notes: input.notes?.trim() ?? null,
          enrolledByUserId: input.actorUserId,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "QaAcceptancePrincipal",
    entityId: principal.id,
    message: `Enrolled QA acceptance principal ${principal.publicReference} (${input.role})`,
    metadata: {
      principalRef: principal.publicReference,
      userId: user.id,
      role: input.role,
      storeId: resolvedStoreId,
      driverProfileId: resolvedDriverProfileId,
    },
  });

  return principal;
}

export async function revokeQaAcceptancePrincipal(input: Readonly<{
  actorUserId: string;
  principalId: string;
  reason: string;
}>) {
  const existing = await prisma.qaAcceptancePrincipal.findUnique({
    where: { id: input.principalId },
  });
  if (!existing) {
    throw new QaAcceptanceError("QA_NOT_FOUND", "QA principal not found.");
  }

  const updated = await prisma.qaAcceptancePrincipal.update({
    where: { id: existing.id },
    data: {
      active: false,
      revokedByUserId: input.actorUserId,
      revokedAt: new Date(),
      revokeReason: input.reason.trim().slice(0, 300) || "Revoked by administrator",
    },
  });

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "STATUS_CHANGE",
    entityType: "QaAcceptancePrincipal",
    entityId: updated.id,
    message: `Revoked QA acceptance principal ${updated.publicReference}`,
    metadata: { principalRef: updated.publicReference, reason: updated.revokeReason },
  });

  return updated;
}

export async function startQaAcceptanceRun(input: Readonly<{
  actorUserId: string;
  title: string;
  storeId?: string | null;
  customerUserId?: string | null;
  driverProfileId?: string | null;
}>) {
  const config = resolveQaAcceptanceLaneConfig();
  if (!config.eligible) {
    throw new QaAcceptanceError("QA_CONFIG_UNAVAILABLE", config.reason);
  }

  const cleanTitle = input.title.trim().slice(0, 160);
  if (!cleanTitle) {
    throw new QaAcceptanceError("QA_INVALID_INPUT", "Run title is required.");
  }

  const run = await prisma.$transaction(
    async (tx) => {
      await ensureQaPlatformSandboxAccountsInTx(tx);
      return tx.qaAcceptanceRun.create({
        data: {
          publicReference: newRef("QARUN"),
          title: cleanTitle,
          status: QaAcceptanceRunStatus.ACTIVE,
          storeId: input.storeId || null,
          customerUserId: input.customerUserId || null,
          driverProfileId: input.driverProfileId || null,
          createdByUserId: input.actorUserId,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "QaAcceptanceRun",
    entityId: run.id,
    message: `Started QA acceptance run ${run.publicReference}: ${run.title}`,
    metadata: {
      runRef: run.publicReference,
      storeId: run.storeId,
      customerUserId: run.customerUserId,
      driverProfileId: run.driverProfileId,
    },
  });

  return run;
}

export async function updateQaAcceptanceRunLifecycle(input: Readonly<{
  actorUserId: string;
  runId: string;
  action: "COMPLETE" | "ARCHIVE_AND_TEARDOWN";
  reason?: string;
}>) {
  const existing = await prisma.qaAcceptanceRun.findUnique({
    where: { id: input.runId },
  });
  if (!existing) {
    throw new QaAcceptanceError("QA_NOT_FOUND", "QA acceptance run not found.");
  }

  const now = new Date();

  if (input.action === "COMPLETE") {
    const completed = await prisma.qaAcceptanceRun.update({
      where: { id: existing.id },
      data: {
        status: QaAcceptanceRunStatus.COMPLETED,
        completedAt: existing.completedAt ?? now,
      },
    });
    await recordAdminActivity({
      actorUserId: input.actorUserId,
      action: "STATUS_CHANGE",
      entityType: "QaAcceptanceRun",
      entityId: completed.id,
      message: `Completed QA acceptance run ${completed.publicReference}`,
      metadata: { runRef: completed.publicReference },
    });
    return completed;
  }

  // ARCHIVE_AND_TEARDOWN: clean up transient open carts & uncommitted draft checkouts
  // while preserving all immutable ledger, payment, order, document, and audit records.
  const archived = await prisma.$transaction(async (tx) => {
    const qaPrincipals = await tx.qaAcceptancePrincipal.findMany({
      select: { userId: true },
    });
    const qaUserIds = qaPrincipals.map((p) => p.userId);
    if (qaUserIds.length > 0) {
      await tx.marketplaceCart.updateMany({
        where: {
          customerUserId: { in: qaUserIds },
          status: "ACTIVE",
        },
        data: { status: "ABANDONED" },
      });
    }

    await tx.marketplaceCheckout.updateMany({
      where: {
        qaAcceptanceRunId: existing.id,
        status: {
          in: [
            "CREATED",
            "VALIDATING",
            "CHANGES_REQUIRED",
            "READY_FOR_REVIEW",
            "RESERVING",
            "RESERVED",
            "PAYMENT_PREPARING",
            "PAYMENT_PENDING",
          ],
        },
        marketplaceOrder: { is: null },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
      },
    });

    return tx.qaAcceptanceRun.update({
      where: { id: existing.id },
      data: {
        status: QaAcceptanceRunStatus.ARCHIVED,
        archivedAt: now,
        archivedByUserId: input.actorUserId,
        archiveReason: input.reason?.trim().slice(0, 300) || "Archived via QA acceptance teardown",
      },
    });
  });

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "STATUS_CHANGE",
    entityType: "QaAcceptanceRun",
    entityId: archived.id,
    message: `Archived and tore down transient drafts for QA run ${archived.publicReference}`,
    metadata: { runRef: archived.publicReference, reason: archived.archiveReason },
  });

  return archived;
}
