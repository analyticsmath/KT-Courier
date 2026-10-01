import { storeAccess } from "@/lib/client-platform/store-access";
import { prisma } from "@/lib/db/prisma";
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
    include: { defaultPickupAddress: true },
  });

  if (!store) return null;

  return {
    store,
    pickupAddress: store.defaultPickupAddress
      ? toSavedAddressDto(store.defaultPickupAddress)
      : null,
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

export async function upsertStorePickupAddress(
  userId: string,
  input: StorePickupAddressInput,
): Promise<SavedAddressDto | null> {
  const store = (await storeAccess(userId, "settings")).store;

  if (!store) return null;

  const pickupAddress = await prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: { storeId: store.id, type: "PICKUP", isDefault: true },
      data: { isDefault: false },
    });

    let address: Address;
    if (store.defaultPickupAddressId) {
      const existing = await tx.address.findFirst({
        where: { id: store.defaultPickupAddressId, storeId: store.id },
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
      },
    });

    await tx.adminActivityLog.create({
      data: {
        actorUserId: userId,
        action: "UPDATE",
        entityType: "Store",
        entityId: store.id,
        message: "Business collection address updated",
        metadata: { addressId: address.id },
      },
    });
    return address;
  });

  return toSavedAddressDto(pickupAddress);
}
