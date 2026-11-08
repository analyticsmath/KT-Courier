import { storeAccess } from "@/lib/client-platform/store-access";
import { selectStorePickupCandidate } from "@/lib/marketplace-checkout/store-pickup-selection";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { rebuildStorefrontStoreDocument } from "@/lib/services/storefront-store.service";
import type { Address, Store } from "@/types/db";
import type { StorePickupAddressInput } from "@/lib/validation/address-book";
import {
  toSavedAddressDto,
  type SavedAddressDto,
} from "@/lib/services/customer-addresses.service";

export interface StorePickupAddressState {
  store: Pick<
    Store,
    | "id"
    | "name"
    | "contactName"
    | "contactPhone"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "province"
    | "postalCode"
    | "country"
    | "defaultPickupAddressId"
  >;
  pickupAddress: SavedAddressDto | null;
}

export async function getStorePickupAddress(
  userId: string,
  section: "settings" | "deliveries" = "settings",
): Promise<StorePickupAddressState | null> {
  const access = await storeAccess(userId, section);
  const store = await prisma.store.findUnique({
    where: { id: access.store.id },
    include: {
      defaultPickupAddress: true,
      // The quote authority already accepts a complete, store-owned saved
      // PICKUP when a stale default pointer is absent or incomplete.
      // Use the same selection rule in the vendor workspace.
      savedAddresses: { where: { type: "PICKUP" }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!store) return null;

  const pickup = selectStorePickupCandidate(
    store.id,
    store.defaultPickupAddress,
    store.savedAddresses,
  );
  return {
    store,
    pickupAddress: pickup ? toSavedAddressDto(pickup) : null,
  };
}

function createAddressData(storeId: string, input: StorePickupAddressInput) {
  return {
    storeId,
    type: "PICKUP" as const,
    label: input.label ?? "Default pickup",
    isDefault: true,
    contactName: input.contactName ?? null,
    contactPhone: input.contactPhone ?? null,
    line1: input.line1,
    line2: input.line2 ?? null,
    city: input.city ?? null,
    province: input.province ?? null,
    postalCode: input.postalCode ?? null,
    country: input.country ?? "South Africa",
    accessNotes: input.accessNotes ?? null,
    formattedAddress: input.formattedAddress ?? null,
    placeId: input.placeId ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  };
}

function updateAddressData(input: StorePickupAddressInput) {
  return {
    type: "PICKUP" as const,
    label: input.label ?? "Default pickup",
    isDefault: true,
    contactName: input.contactName ?? null,
    contactPhone: input.contactPhone ?? null,
    line1: input.line1,
    line2: input.line2 ?? null,
    city: input.city ?? null,
    province: input.province ?? null,
    postalCode: input.postalCode ?? null,
    country: input.country ?? "South Africa",
    accessNotes: input.accessNotes ?? null,
    formattedAddress: input.formattedAddress ?? null,
    placeId: input.placeId ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  };
}

function storeAddressData(input: StorePickupAddressInput) {
  return {
    contactName: input.contactName ?? null,
    contactPhone: input.contactPhone ?? null,
    addressLine1: input.line1,
    addressLine2: input.line2 ?? null,
    city: input.city ?? null,
    province: input.province ?? null,
    postalCode: input.postalCode ?? null,
    country: input.country ?? "South Africa",
  };
}

/** A mapped collection location is part of the store's live checkout authority.
 * A new pickup pin or locality requires fresh route/checkout certification.
 * Changing only contact instructions must not unnecessarily delist a store.
 */
export function hasStorePickupLocationChanged(
  previous: Pick<Address, "line1" | "line2" | "city" | "province" | "postalCode" | "country" | "placeId" | "latitude" | "longitude"> | null,
  next: StorePickupAddressInput,
): boolean {
  if (!previous) return true;
  const normalized = (value: string | null | undefined) => (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-ZA");
  for (const field of ["line1", "line2", "city", "province", "postalCode", "country", "placeId"] as const) {
    if (normalized(previous[field]) !== normalized(next[field] ?? (field === "country" ? "South Africa" : ""))) return true;
  }
  return Number(previous.latitude) !== next.latitude || Number(previous.longitude) !== next.longitude;
}

export async function upsertStorePickupAddress(
  userId: string,
  input: StorePickupAddressInput,
): Promise<SavedAddressDto | null> {
  const store = (await storeAccess(userId, "settings")).store;

  if (!store) return null;

  const pickupAddress = await prisma.$transaction(async (tx) => {
    // Serialize with administrative store activation. The live projection and
    // any recertification state change must commit with the new pickup address.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Store" WHERE "id" = ${store.id} FOR UPDATE`);
    const current = await tx.store.findUniqueOrThrow({
      where: { id: store.id },
      include: { defaultPickupAddress: true },
    });
    const locationChanged = hasStorePickupLocationChanged(current.defaultPickupAddress, input);
    const revokeLiveStatus = current.status === "ACTIVE" && locationChanged;
    await tx.address.updateMany({
      where: { storeId: store.id, type: "PICKUP", isDefault: true },
      data: { isDefault: false },
    });

    let address: Address;
    if (current.defaultPickupAddressId) {
      const existing = await tx.address.findFirst({
        where: { id: current.defaultPickupAddressId, storeId: store.id },
      });
      if (existing) {
        address = await tx.address.update({
          where: { id: existing.id },
          data: updateAddressData(input),
        });
      } else {
        address = await tx.address.create({
          data: createAddressData(store.id, input),
        });
      }
    } else {
      address = await tx.address.create({
        data: createAddressData(store.id, input),
      });
    }

    await tx.store.update({
      where: { id: store.id },
      data: {
        ...storeAddressData(input),
        defaultPickupAddressId: address.id,
        ...(revokeLiveStatus ? { status: "PENDING", featured: false } : {}),
      },
    });
    // A stale ACTIVE storefront document must never keep accepting sales after
    // the certified collection point has moved. Projection refresh is atomic.
    if (locationChanged) {
      // Revoke stale checkout evidence even if the store is already pending.
      await tx.storeCheckoutCertification.updateMany({
        where: { storeId: store.id, status: "APPROVED" },
        data: { status: "REVOKED", revision: { increment: 1 } },
      });
    }
    if (revokeLiveStatus) await rebuildStorefrontStoreDocument(store.id, tx);

    await tx.adminActivityLog.create({
      data: {
        actorUserId: userId,
        action: "UPDATE",
        entityType: "Store",
        entityId: store.id,
        message: "Business collection address updated",
        metadata: {
          addressId: address.id,
          locationChanged,
          liveStatusRevoked: revokeLiveStatus,
          ...(revokeLiveStatus ? { reason: "PICKUP_CHANGED_REQUIRES_ROUTE_AND_CHECKOUT_RECERTIFICATION" } : {}),
        },
      },
    });
    return address;
  });

  return toSavedAddressDto(pickupAddress);
}
