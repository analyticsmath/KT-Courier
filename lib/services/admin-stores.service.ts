import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { rebuildStorefrontStoreDocument } from "@/lib/services/storefront-store.service";
import { assertAdvertisingProductionReady } from "@/lib/advertising/production-lock";
import {
  toAdminStoreListItem,
  type AdminStoreListItem,
} from "@/lib/dto/user.dto";
import type { StoreStatus } from "@/types/db";
import { selectStorePickupCandidate } from "@/lib/marketplace-checkout/store-pickup-selection";
import { describeStoreCollectionEvidence, type StoreCollectionEvidenceSummary } from "@/lib/admin/store-pickup-readiness";
import { describeStoreCheckoutBlockers } from "@/lib/admin/store-checkout-blockers";
import { getGlobalCommercePolicyRevision } from "@/lib/admin/commerce-readiness-revision";

// ─── List ─────────────────────────────────────────────────────────────────────

export interface AdminStoreListOptions {
  status?: StoreStatus;
  missingDefaultPickup?: boolean;
  checkoutBlocked?: boolean;
  featured?: boolean;
  search?: string;
  page: number;
  pageSize: number;
}

export interface AdminStoreListResult {
  data: (AdminStoreListItem & { pickupReadiness: StoreCollectionEvidenceSummary; checkoutBlockers: string[] })[];
  total: number;
}

export async function listStores(
  opts: AdminStoreListOptions
): Promise<AdminStoreListResult> {
  const { status, missingDefaultPickup, checkoutBlocked, featured, search, page, pageSize } = opts;
  const needsCompleteInventory = Boolean(missingDefaultPickup || checkoutBlocked);
  const skip = (page - 1) * pageSize;

  const where = {
    ...(status && { status }),
    ...(featured !== undefined && { featured }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { contactEmail: { contains: search, mode: "insensitive" as const } },
        { contactName: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
      where,
      ...(needsCompleteInventory ? {} : { skip, take: pageSize }),
      orderBy: { createdAt: "desc" },
      include: {
        ownerUser: true,
        defaultPickupAddress: true,
        savedAddresses: { where: { type: "PICKUP" } },
        checkoutCertification: true,
        storefrontDocument: { select: { publishedOfferCount: true } },
      },
    }),
    prisma.store.count({ where }),
  ]);

  const now = new Date();
  const storeIds = stores.map((store) => store.id);
  const [sellerIdentities, activeOperationalPolicy, commissionPlans, currentGlobalPolicyRevision] = await Promise.all([
    storeIds.length > 0 && prisma.storeSellerLegalIdentity?.findMany
      ? prisma.storeSellerLegalIdentity.findMany({
          where: {
            storeId: { in: storeIds },
            status: "APPROVED",
            effectiveFrom: { lte: now },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
          },
          select: { storeId: true },
        })
      : Promise.resolve(null),
    prisma.storeOrderOperationalPolicy?.findFirst
      ? prisma.storeOrderOperationalPolicy.findFirst({
          where: {
            status: "ACTIVE",
            effectiveFrom: { lte: now },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
          },
          select: { id: true },
        })
      : Promise.resolve(undefined),
    storeIds.length > 0 && prisma.commissionPlan?.findMany
      ? prisma.commissionPlan.findMany({
          where: {
            subjectType: "MARKETPLACE_STORE_ORDER",
            scopeKey: { in: storeIds.map((storeId) => `STORE:${storeId}`) },
            currency: "ZAR",
            status: "ACTIVE",
            approvedAt: { not: null },
            effectiveFrom: { lte: now },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
          },
          select: { scopeKey: true },
        })
      : Promise.resolve([]),
    typeof (prisma as unknown as { systemSetting?: { findUnique?: unknown } }).systemSetting?.findUnique === "function"
      ? getGlobalCommercePolicyRevision(prisma)
      : Promise.resolve(1),
  ]);
  const approvedIdentityStoreIds = new Set(
    (sellerIdentities ?? []).map((item) => item.storeId),
  );
  const activeCommissionPlanScopes = new Set(
    (commissionPlans ?? []).map((item) => item.scopeKey),
  );
  const hasActiveOperationalPolicy = Boolean(activeOperationalPolicy);
  const mapped = stores.map((store) => {
    const pickup = selectStorePickupCandidate(store.id, store.defaultPickupAddress, store.savedAddresses);
    return {
      ...toAdminStoreListItem(store),
      pickupReadiness: describeStoreCollectionEvidence(pickup),
      checkoutBlockers: describeStoreCheckoutBlockers({
        status: store.status,
        name: store.name,
        publishedOfferCount: store.storefrontDocument?.publishedOfferCount ?? 0,
        pickup,
        certification: store.checkoutCertification,
        hasApprovedSellerIdentity: approvedIdentityStoreIds.has(store.id),
        hasActiveOperationalPolicy,
        hasActiveCommissionPlan: activeCommissionPlanScopes.has(`STORE:${store.id}`),
        storeCommerceReadinessRevision: store.commerceReadinessRevision ?? 1,
        currentGlobalPolicyRevision,
        now,
      }),
    };
  });
  // These are operator-facing read-only filters, not a change to payment,
  // publication, certification or any merchant account state.
  const filtered = missingDefaultPickup
    ? mapped.filter((store) => !store.pickupReadiness.checkoutPickupConfigured)
    : checkoutBlocked
      ? mapped.filter((store) => store.checkoutBlockers.length > 0)
      : mapped;
  return {
    data: needsCompleteInventory ? filtered.slice(skip, skip + pageSize) : filtered,
    total: needsCompleteInventory ? filtered.length : total,
  };
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getStoreDetail(id: string) {
  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      ownerUser: { include: { storeProfile: true } },
      defaultPickupAddress: true,
      savedAddresses: { where: { type: "PICKUP" } },
    },
  });
  if (!store) return null;

  const orderCount = await prisma.order.count({ where: { storeId: id } });

  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    status: store.status,
    featured: store.featured,
    commerceReadinessRevision: store.commerceReadinessRevision,
    contactName: store.contactName,
    contactEmail: store.contactEmail,
    contactPhone: store.contactPhone,
    addressLine1: store.addressLine1,
    addressLine2: store.addressLine2,
    city: store.city,
    province: store.province,
    postalCode: store.postalCode,
    country: store.country,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
    orderCount,
    defaultPickupAddressId: store.defaultPickupAddressId,
    pickupReadiness: describeStoreCollectionEvidence(
      selectStorePickupCandidate(store.id, store.defaultPickupAddress, store.savedAddresses),
    ),
    ownerUser: store.ownerUser
      ? {
          id: store.ownerUser.id,
          email: store.ownerUser.email,
          name: store.ownerUser.name,
          phone: store.ownerUser.phone,
          status: store.ownerUser.status,
          emailVerifiedAt: store.ownerUser.emailVerifiedAt,
          createdAt: store.ownerUser.createdAt,
          storeProfile: store.ownerUser.storeProfile ? {
            storeName: store.ownerUser.storeProfile.storeName,
            contactPerson: store.ownerUser.storeProfile.contactPerson,
            businessPhone: store.ownerUser.storeProfile.businessPhone,
            businessEmail: store.ownerUser.storeProfile.businessEmail,
            status: store.ownerUser.storeProfile.status,
          } : null,
        }
      : null,
  };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export interface AdminUpdateStoreInput {
  name?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

export async function adminUpdateStore(
  id: string,
  input: AdminUpdateStoreInput
) {
  return prisma.store.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.contactName !== undefined && { contactName: input.contactName || null }),
      ...(input.contactEmail !== undefined && { contactEmail: input.contactEmail || null }),
      ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone || null }),
      ...(input.addressLine1 !== undefined && { addressLine1: input.addressLine1 || null }),
      ...(input.addressLine2 !== undefined && { addressLine2: input.addressLine2 || null }),
      ...(input.city !== undefined && { city: input.city || null }),
      ...(input.province !== undefined && { province: input.province || null }),
      ...(input.postalCode !== undefined && { postalCode: input.postalCode || null }),
     },
  });
}

export class StoreActivationReadinessError extends Error {
  constructor(readonly blockers: readonly string[], message?: string) {
    super(
      message ??
        `Business account approval is blocked until owner verification and business contact checks pass: ${blockers.join(", ")}.`,
    );
    this.name = "StoreActivationReadinessError";
  }
}

export async function setStoreStatus(
  id: string,
  status: StoreStatus,
  audit?: { actorUserId: string; reason?: string },
) {
  // Status, visibility and the audit reason must commit together cleanly.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Store" WHERE "id" = ${id} FOR UPDATE`);
    const before = await tx.store.findUnique({
      where: { id },
      select: {
        name: true,
        status: true,
        contactEmail: true,
        contactPhone: true,
        ownerUser: {
          select: {
            id: true,
            status: true,
            emailVerifiedAt: true,
            storeProfile: {
              select: {
                businessEmail: true,
                businessPhone: true,
              },
            },
          },
        },
      },
    });
    if (!before) {
      throw new StoreActivationReadinessError(["STORE_NOT_FOUND"]);
    }

    if (audit?.actorUserId) {
      const actor = await tx.user.findUnique({
        where: { id: audit.actorUserId },
        select: { role: true, status: true },
      });
      if (!actor || actor.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
        throw new StoreActivationReadinessError(["ADMIN_AUTHORIZATION_REQUIRED"]);
      }
    }

    if (status === "ACTIVE") {
      const blockers: string[] = [];
      if (!before.name.trim()) blockers.push("STORE_NAME_MISSING");
      if (!before.ownerUser) {
        blockers.push("STORE_OWNER_MISSING");
      } else {
        if (before.ownerUser.status !== "ACTIVE") blockers.push("OWNER_ACCOUNT_NOT_ACTIVE");
        if (!before.ownerUser.emailVerifiedAt) blockers.push("OWNER_EMAIL_NOT_VERIFIED");
      }
      const contactEmail = (before.contactEmail ?? before.ownerUser?.storeProfile?.businessEmail ?? "").trim();
      const contactPhone = (before.contactPhone ?? before.ownerUser?.storeProfile?.businessPhone ?? "").trim();
      const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail);
      const hasValidPhone = contactPhone.replace(/\D/g, "").length >= 7;
      if (!hasValidEmail && !hasValidPhone) {
        blockers.push("BUSINESS_CONTACT_MISSING");
      }
      if (blockers.length > 0) {
        throw new StoreActivationReadinessError(blockers);
      }
    }

    const updated = await tx.store.update({
      where: { id },
      data: { status, ...(status !== "ACTIVE" ? { featured: false } : {}) },
    });
    await rebuildStorefrontStoreDocument(id, tx);
    if (audit) {
      await tx.adminActivityLog.create({
        data: {
          actorUserId: audit.actorUserId,
          action: "STATUS_CHANGE",
          entityType: "Store",
          entityId: id,
          message: `Changed store "${before.name}" status from ${before.status} to ${status}`,
          metadata: { from: before.status, to: status, reason: audit.reason?.trim() ?? null },
        },
      });
    }
    return updated;
  });
}

export async function setStoreFeatured(id: string, featured: boolean) {
  if (featured) {
    // The legacy admin flag cannot bypass paid campaign validation.
    assertAdvertisingProductionReady("SPONSORED_SERVING");
    const now = new Date();
    const eligible = await prisma.advertisingCampaignVersion.findFirst({
      where: {
        sponsoredObjectType: "STORE",
        sponsoredStoreId: id,
        status: "ACTIVE",
        startsAt: { lte: now },
        endsAt: { gt: now },
        campaign: { storeId: id, status: "ACTIVE", store: { status: "ACTIVE" } },
        fundingAllocations: {
          some: { storeId: id, status: { in: ["FUNDED", "PARTIALLY_SPENT"] }, remainingAmount: { gt: 0 } },
        },
      },
      select: { id: true },
    });
    if (!eligible) throw new Error("A current, active, funded store advertising campaign is required before featuring this store.");
  }
  return prisma.store.update({ where: { id }, data: { featured } });
}

// ─── Dashboard aggregates ─────────────────────────────────────────────────────

export interface AdminDashboardStats {
  totalUsers: number;
  totalStores: number;
  pendingStores: number;
  activeStores: number;
  customerCount: number;
  storeUserCount: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [
    totalUsers,
    totalStores,
    pendingStores,
    activeStores,
    customerCount,
    storeUserCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.store.count(),
    prisma.store.count({ where: { status: "PENDING" } }),
    prisma.store.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "STORE" } }),
  ]);

  return {
    totalUsers,
    totalStores,
    pendingStores,
    activeStores,
    customerCount,
    storeUserCount,
  };
}
