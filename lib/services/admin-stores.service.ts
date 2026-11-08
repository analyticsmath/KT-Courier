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
import { getStorePickupOperationalPreflight } from "@/lib/admin/store-pickup-preflight.service";
import { currentStoreCertificationFacts, requireCurrentStoreCheckoutCertification, type StoreCertificationFacts } from "@/lib/admin/store-checkout-certification.service";
import { describeStoreCollectionEvidence, type StoreCollectionEvidenceSummary } from "@/lib/admin/store-pickup-readiness";

// ─── List ─────────────────────────────────────────────────────────────────────

export interface AdminStoreListOptions {
  status?: StoreStatus;
  missingDefaultPickup?: boolean;
  featured?: boolean;
  search?: string;
  page: number;
  pageSize: number;
}

export interface AdminStoreListResult {
  data: (AdminStoreListItem & { pickupReadiness: StoreCollectionEvidenceSummary })[];
  total: number;
}

export async function listStores(
  opts: AdminStoreListOptions
): Promise<AdminStoreListResult> {
  const { status, missingDefaultPickup, featured, search, page, pageSize } = opts;
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
      ...(missingDefaultPickup ? {} : { skip, take: pageSize }),
      orderBy: { createdAt: "desc" },
      include: { ownerUser: true, defaultPickupAddress: true, savedAddresses: { where: { type: "PICKUP" } } },
    }),
    prisma.store.count({ where }),
  ]);

  return {
    data: (() => {
      const mapped = stores.map((store) => ({
        ...toAdminStoreListItem(store),
        pickupReadiness: describeStoreCollectionEvidence(
          selectStorePickupCandidate(store.id, store.defaultPickupAddress, store.savedAddresses),
        ),
      }));
      const filtered = missingDefaultPickup ? mapped.filter((store) => !store.pickupReadiness.checkoutPickupConfigured) : mapped;
      return missingDefaultPickup ? filtered.slice(skip, skip + pageSize) : filtered;
    })(),
    total: missingDefaultPickup ? stores.filter((store) => !describeStoreCollectionEvidence(selectStorePickupCandidate(store.id, store.defaultPickupAddress, store.savedAddresses)).checkoutPickupConfigured).length : total,
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
  constructor(readonly blockers: readonly string[]) {
    super(`Store approval is blocked until the collection address and pickup service-area checks pass: ${blockers.join(", ")}.`);
    this.name = "StoreActivationReadinessError";
  }
}

export async function setStoreStatus(
  id: string,
  status: StoreStatus,
  audit?: { actorUserId: string; reason?: string },
) {
  let certificationFacts: StoreCertificationFacts | null = null;
  if (status === "ACTIVE") {
    const readiness = await getStorePickupOperationalPreflight(id);
    if (!readiness || readiness.blockers.length > 0) {
      throw new StoreActivationReadinessError(readiness?.blockers ?? ["STORE_NOT_FOUND"]);
    }
    certificationFacts = await currentStoreCertificationFacts(id);
  }
  // Status, visibility and the reason shown to the vendor must commit together.
  return prisma.$transaction(async (tx) => {
    // Serialize approval with an owner changing the checkout-owned pickup pin.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Store" WHERE "id" = ${id} FOR UPDATE`);
    const before = await tx.store.findUniqueOrThrow({
      where: { id },
      select: { name: true, status: true },
    });
    // Legacy ACTIVE accounts are not blindly delisted; every NEW transition
    // into Live requires independent approval of current staging evidence.
    if (status === "ACTIVE" && before.status !== "ACTIVE") {
      if (!certificationFacts) throw new StoreActivationReadinessError(["CHECKOUT_CERTIFICATION_REQUIRED"]);
      await requireCurrentStoreCheckoutCertification(tx, id, certificationFacts);
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
