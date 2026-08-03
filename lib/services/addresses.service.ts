import { prisma } from "@/lib/db/prisma";
import type { AddressType } from "@/types/db";
import type { AddressInput } from "@/lib/validation/address";

export interface CreateAddressInput extends AddressInput {
  type: AddressType;
}

export async function createAddress(input: CreateAddressInput) {
  return prisma.address.create({
    data: {
      type: input.type,
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
      latitude: input.latitude !== undefined ? input.latitude : null,
      longitude: input.longitude !== undefined ? input.longitude : null,
    },
  });
}
