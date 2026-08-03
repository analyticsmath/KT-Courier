import { prisma } from "@/lib/db/prisma";
import type { Address, AddressType } from "@/types/db";
import type {
  SavedAddressCreateInput,
  SavedAddressUpdateInput,
} from "@/lib/validation/address-book";

export interface SavedAddressDto {
  id: string;
  type: AddressType;
  label: string | null;
  isDefault: boolean;
  contactName: string | null;
  contactPhone: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  accessNotes: string | null;
  formattedAddress: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toSavedAddressDto(address: Address): SavedAddressDto {
  return {
    id: address.id,
    type: address.type,
    label: address.label,
    isDefault: address.isDefault,
    contactName: address.contactName,
    contactPhone: address.contactPhone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    country: address.country,
    accessNotes: address.accessNotes,
    formattedAddress: address.formattedAddress,
    placeId: address.placeId,
    latitude: address.latitude !== null ? Number(address.latitude) : null,
    longitude: address.longitude !== null ? Number(address.longitude) : null,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

function createData(userId: string, input: SavedAddressCreateInput) {
  return {
    userId,
    type: input.type,
    label: input.label ?? null,
    isDefault: input.isDefault ?? false,
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

function updateData(input: SavedAddressUpdateInput) {
  return {
    ...(input.type !== undefined && { type: input.type }),
    ...(input.label !== undefined && { label: input.label || null }),
    ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
    ...(input.contactName !== undefined && { contactName: input.contactName || null }),
    ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone || null }),
    ...(input.line1 !== undefined && { line1: input.line1 }),
    ...(input.line2 !== undefined && { line2: input.line2 || null }),
    ...(input.city !== undefined && { city: input.city || null }),
    ...(input.province !== undefined && { province: input.province || null }),
    ...(input.postalCode !== undefined && { postalCode: input.postalCode || null }),
    ...(input.country !== undefined && { country: input.country || "South Africa" }),
    ...(input.accessNotes !== undefined && { accessNotes: input.accessNotes || null }),
    ...(input.formattedAddress !== undefined && { formattedAddress: input.formattedAddress || null }),
    ...(input.placeId !== undefined && { placeId: input.placeId || null }),
    ...(input.latitude !== undefined && { latitude: input.latitude ?? null }),
    ...(input.longitude !== undefined && { longitude: input.longitude ?? null }),
  };
}

export async function listCustomerAddresses(userId: string): Promise<SavedAddressDto[]> {
  const addresses = await prisma.address.findMany({
    where: { userId, storeId: null },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  return addresses.map(toSavedAddressDto);
}

export async function getCustomerAddress(
  userId: string,
  addressId: string
): Promise<SavedAddressDto | null> {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId, storeId: null },
  });
  return address ? toSavedAddressDto(address) : null;
}

export async function createCustomerAddress(
  userId: string,
  input: SavedAddressCreateInput
): Promise<SavedAddressDto> {
  const address = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.address.updateMany({
        where: { userId, storeId: null, type: input.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.address.create({
      data: createData(userId, input),
    });
  });

  return toSavedAddressDto(address);
}

export async function updateCustomerAddress(
  userId: string,
  addressId: string,
  input: SavedAddressUpdateInput
): Promise<SavedAddressDto | null> {
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId, storeId: null },
  });
  if (!existing) return null;

  const nextType = input.type ?? existing.type;
  const nextDefault = input.isDefault ?? existing.isDefault;

  const updated = await prisma.$transaction(async (tx) => {
    if (nextDefault) {
      await tx.address.updateMany({
        where: {
          userId,
          storeId: null,
          type: nextType,
          isDefault: true,
          id: { not: addressId },
        },
        data: { isDefault: false },
      });
    }

    return tx.address.update({
      where: { id: addressId },
      data: updateData(input),
    });
  });

  return toSavedAddressDto(updated);
}

export async function deleteCustomerAddress(
  userId: string,
  addressId: string
): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" | "ORDER_SNAPSHOT" }> {
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId, storeId: null },
    select: {
      id: true,
      _count: {
        select: {
          pickupOrders: true,
          dropoffOrders: true,
        },
      },
    },
  });

  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  if (existing._count.pickupOrders > 0 || existing._count.dropoffOrders > 0) {
    return { ok: false, reason: "ORDER_SNAPSHOT" };
  }

  await prisma.address.delete({ where: { id: addressId } });
  return { ok: true };
}
