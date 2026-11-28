import { randomUUID } from "node:crypto";
import { Prisma, QaAcceptanceRole, QaAcceptanceRunStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { resolveQaAcceptanceLaneConfig } from "./config";
import { ensureOwnerWalletIsolatedForQaInTx, ensureQaPlatformSandboxAccountsInTx } from "./ledger";
import { buildQaReconciliationDetails } from "./reconciliation-detail";
export {
  recordQaSyntheticPackageDraft,
  reviewAndActivateQaSyntheticPackaging,
  QaPackagingError,
} from "./synthetic-packaging";
export {
  prepareQaSettlementRecovery,
  reviewQaSettlementRecovery,
  listAllQaSettlementRecoveries,
  QaSettlementRecoveryError,
} from "./settlement-recovery";

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
        : {
            OR: [
              { isQaAcceptance: true },
              { name: { contains: "kaventra", mode: "insensitive" } },
              { slug: { contains: "qa", mode: "insensitive" } },
            ],
          },
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

  const enrolledQaStoreIds = principals
    .filter((p) => p.active && p.role === QaAcceptanceRole.VENDOR && p.storeId)
    .map((p) => p.storeId as string);
  const details = await buildQaReconciliationDetails({
    isolatedWallets: sandboxAccounts,
    runs,
    enrolledQaStoreIds,
  });

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
      ...details,
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
      ownedStores: { select: { id: true, name: true, slug: true, isQaAcceptance: true }, take: 5 },
      driverProfile: { select: { id: true, driverCode: true, isQaAcceptance: true } },
    },
  });

  if (!user) {
    throw new QaAcceptanceError("QA_NOT_FOUND", `Account not found for identifier '${identifier}'.`);
  }

  if (user.status !== "ACTIVE") {
    throw new QaAcceptanceError("QA_INVALID_INPUT", "Only ACTIVE user accounts may be enrolled in QA acceptance.");
  }

  const expectedUserRoles: Record<QaAcceptanceRole, readonly string[]> = {
    ADMIN: ["ADMIN", "SUPER_ADMIN"],
    CUSTOMER: ["CUSTOMER"],
    VENDOR: ["STORE"],
    DRIVER: ["DRIVER"],
  };
  if (!expectedUserRoles[input.role].includes(user.role)) {
    throw new QaAcceptanceError(
      "QA_INVALID_INPUT",
      `User role ${user.role} does not match QA principal role ${input.role}.`,
    );
  }

  let resolvedStoreId: string | null = null;
  if (input.role === "VENDOR") {
    const storeIdent = input.storeIdentifier?.trim();
    if (storeIdent) {
      const store = await prisma.store.findFirst({
        where: { OR: [{ id: storeIdent }, { slug: storeIdent }, { name: { equals: storeIdent, mode: "insensitive" } }] },
        select: { id: true, ownerUserId: true, isQaAcceptance: true },
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
      // Prevent accidental enrolment of live/commercial users, stores, or drivers
      // before flipping any QA isolation flag.
      if (!user.isQaAcceptance) {
        const [nonQaOrders, nonQaPayments, nonQaCheckouts, nonQaMarketplaceOrders, customerWallet] =
          await Promise.all([
            tx.order.count({ where: { customerId: user.id, isQaAcceptance: false } }),
            tx.payment.count({ where: { userId: user.id, isQaAcceptance: false } }),
            tx.marketplaceCheckout.count({ where: { customerUserId: user.id, isQaAcceptance: false } }),
            tx.marketplaceOrder.count({ where: { customerUserId: user.id, isQaAcceptance: false } }),
            tx.wallet.findUnique({
              where: { ownerType_ownerId_currency: { ownerType: "CUSTOMER", ownerId: user.id, currency: "ZAR" } },
              include: { accounts: { select: { id: true, currentBalance: true } } },
            }),
          ]);
        const customerWalletEntryCount =
          customerWallet && !customerWallet.isQaIsolated && customerWallet.accounts.length > 0
            ? await tx.ledgerEntry.count({
                where: { accountId: { in: customerWallet.accounts.map((a) => a.id) } },
              })
            : 0;
        const customerWalletHasBalance = Boolean(
          customerWallet &&
            !customerWallet.isQaIsolated &&
            customerWallet.accounts.some((a) => !a.currentBalance.isZero()),
        );
        if (
          nonQaOrders > 0 ||
          nonQaPayments > 0 ||
          nonQaCheckouts > 0 ||
          nonQaMarketplaceOrders > 0 ||
          customerWalletEntryCount > 0 ||
          customerWalletHasBalance
        ) {
          throw new QaAcceptanceError(
            "QA_ISOLATION_VIOLATION",
            "Cannot enroll an existing commercial account with live orders, payments, or wallet history into QA acceptance.",
          );
        }
      }

      if (resolvedStoreId) {
        const storeRow = await tx.store.findUnique({
          where: { id: resolvedStoreId },
          select: { isQaAcceptance: true },
        });
        if (!storeRow?.isQaAcceptance) {
          const [
            storeOrders,
            mpStoreOrders,
            storeEarnings,
            liveStoreDoc,
            liveProductDocs,
            publishedOffers,
            cert,
            storeWallet,
          ] = await Promise.all([
            tx.order.count({ where: { storeId: resolvedStoreId, isQaAcceptance: false } }),
            tx.marketplaceStoreOrder.count({ where: { storeId: resolvedStoreId, isQaAcceptance: false } }),
            tx.storeEarning.count({ where: { storeId: resolvedStoreId, isQaAcceptance: false } }),
            tx.storefrontStoreDocument.count({ where: { storeId: resolvedStoreId, publicStatus: "ACTIVE" } }),
            tx.storefrontProductDocument.count({ where: { storeId: resolvedStoreId, status: "ACTIVE" } }),
            tx.storeCatalogOffer.count({ where: { storeId: resolvedStoreId, publicationStatus: "PUBLISHED" } }),
            tx.storeCheckoutCertification.findUnique({
              where: { storeId: resolvedStoreId },
              select: { status: true, proofMetadata: true },
            }),
            tx.wallet.findUnique({
              where: { ownerType_ownerId_currency: { ownerType: "STORE", ownerId: resolvedStoreId, currency: "ZAR" } },
              include: { accounts: { select: { id: true, currentBalance: true } } },
            }),
          ]);
          const storeWalletEntryCount =
            storeWallet && !storeWallet.isQaIsolated && storeWallet.accounts.length > 0
              ? await tx.ledgerEntry.count({
                  where: { accountId: { in: storeWallet.accounts.map((a) => a.id) } },
                })
              : 0;
          const storeWalletHasBalance = Boolean(
            storeWallet &&
              !storeWallet.isQaIsolated &&
              storeWallet.accounts.some((a) => !a.currentBalance.isZero()),
          );
          const hasCommercialCert = Boolean(
            cert?.status === "APPROVED" &&
              !(cert.proofMetadata && typeof cert.proofMetadata === "object" && (cert.proofMetadata as { qaAcceptanceOnly?: unknown }).qaAcceptanceOnly === true),
          );
          if (
            storeOrders > 0 ||
            mpStoreOrders > 0 ||
            storeEarnings > 0 ||
            liveStoreDoc > 0 ||
            liveProductDocs > 0 ||
            publishedOffers > 0 ||
            hasCommercialCert ||
            storeWalletEntryCount > 0 ||
            storeWalletHasBalance
          ) {
            throw new QaAcceptanceError(
              "QA_ISOLATION_VIOLATION",
              "Cannot enroll a live or commercial store with commercial orders, published catalog offers, earnings, or public certification into QA acceptance.",
            );
          }
        }
      }

      if (resolvedDriverProfileId) {
        const driverRow = await tx.driverProfile.findUnique({
          where: { id: resolvedDriverProfileId },
          select: { isQaAcceptance: true },
        });
        if (!driverRow?.isQaAcceptance) {
          const [nonQaAssignments, nonQaDriverEarnings, driverWallet] = await Promise.all([
            tx.orderAssignment.count({
              where: { driverProfileId: resolvedDriverProfileId, order: { isQaAcceptance: false } },
            }),
            tx.driverEarning.count({
              where: { driverId: resolvedDriverProfileId, isQaAcceptance: false },
            }),
            tx.wallet.findUnique({
              where: { ownerType_ownerId_currency: { ownerType: "DRIVER", ownerId: resolvedDriverProfileId, currency: "ZAR" } },
              include: { accounts: { select: { id: true, currentBalance: true } } },
            }),
          ]);
          const driverWalletEntryCount =
            driverWallet && !driverWallet.isQaIsolated && driverWallet.accounts.length > 0
              ? await tx.ledgerEntry.count({
                  where: { accountId: { in: driverWallet.accounts.map((a) => a.id) } },
                })
              : 0;
          const driverWalletHasBalance = Boolean(
            driverWallet &&
              !driverWallet.isQaIsolated &&
              driverWallet.accounts.some((a) => !a.currentBalance.isZero()),
          );
          if (
            nonQaAssignments > 0 ||
            nonQaDriverEarnings > 0 ||
            driverWalletEntryCount > 0 ||
            driverWalletHasBalance
          ) {
            throw new QaAcceptanceError(
              "QA_ISOLATION_VIOLATION",
              "Cannot enroll an active commercial driver with non-QA dispatch assignments, earnings, or wallet history into QA acceptance.",
            );
          }
        }
      }

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
      if (input.storeId) {
        const [store, storePrincipal] = await Promise.all([
          tx.store.findUnique({ where: { id: input.storeId }, select: { id: true, isQaAcceptance: true } }),
          tx.qaAcceptancePrincipal.findFirst({
            where: { storeId: input.storeId, role: QaAcceptanceRole.VENDOR, active: true, revokedAt: null },
            select: { id: true },
          }),
        ]);
        if (!store?.isQaAcceptance || !storePrincipal) {
          throw new QaAcceptanceError(
            "QA_ISOLATION_VIOLATION",
            "Run storeId must reference an actively enrolled QA vendor store.",
          );
        }
      }
      if (input.customerUserId) {
        const [cust, custPrincipal] = await Promise.all([
          tx.user.findUnique({ where: { id: input.customerUserId }, select: { id: true, isQaAcceptance: true, status: true } }),
          tx.qaAcceptancePrincipal.findFirst({
            where: { userId: input.customerUserId, role: QaAcceptanceRole.CUSTOMER, active: true, revokedAt: null },
            select: { id: true },
          }),
        ]);
        if (!cust?.isQaAcceptance || cust.status !== "ACTIVE" || !custPrincipal) {
          throw new QaAcceptanceError(
            "QA_ISOLATION_VIOLATION",
            "Run customerUserId must reference an actively enrolled QA customer.",
          );
        }
      }
      if (input.driverProfileId) {
        const [drv, drvPrincipal] = await Promise.all([
          tx.driverProfile.findUnique({ where: { id: input.driverProfileId }, select: { id: true, isQaAcceptance: true } }),
          tx.qaAcceptancePrincipal.findFirst({
            where: { driverProfileId: input.driverProfileId, role: QaAcceptanceRole.DRIVER, active: true, revokedAt: null },
            select: { id: true },
          }),
        ]);
        if (!drv?.isQaAcceptance || !drvPrincipal) {
          throw new QaAcceptanceError(
            "QA_ISOLATION_VIOLATION",
            "Run driverProfileId must reference an actively enrolled QA driver.",
          );
        }
      }
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
