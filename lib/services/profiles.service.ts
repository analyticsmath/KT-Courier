import { storeAccess } from "@/lib/client-platform/store-access";
import { prisma } from "@/lib/db/prisma";
import {
  toCustomerProfileDto,
  toStoreProfileDto,
  type CustomerProfileDto,
  type StoreProfileDto,
} from "@/lib/dto/user.dto";

// ─── Customer profile ─────────────────────────────────────────────────────────

export async function getCustomerProfile(
  userId: string,
): Promise<CustomerProfileDto | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customerProfile: true },
  });
  if (!user) return null;
  return toCustomerProfileDto(user, user.customerProfile);
}

export interface UpdateCustomerProfileInput {
  name?: string;
  phone?: string;
}

export async function updateCustomerProfile(
  userId: string,
  input: UpdateCustomerProfileInput,
): Promise<CustomerProfileDto> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name || null }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
    },
    include: { customerProfile: true },
  });

  // Keep CustomerProfile in sync
  if (user.customerProfile) {
    await prisma.customerProfile.update({
      where: { userId },
      data: {
        ...(input.name !== undefined && { displayName: input.name || null }),
        ...(input.phone !== undefined && { defaultPhone: input.phone || null }),
      },
    });
  } else {
    await prisma.customerProfile.create({
      data: {
        userId,
        displayName: input.name || null,
        defaultPhone: input.phone || null,
      },
    });
  }

  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { customerProfile: true },
  });
  return toCustomerProfileDto(updated, updated.customerProfile);
}

// ─── Store profile ────────────────────────────────────────────────────────────

export async function getStoreProfile(
  userId: string,
): Promise<StoreProfileDto | null> {
  const access = await storeAccess(userId, "settings");
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    access.store.ownerUserId
      ? prisma.storeProfile.findUnique({
          where: { userId: access.store.ownerUserId },
        })
      : null,
  ]);
  return user ? toStoreProfileDto(user, profile, access.store) : null;
}

export interface UpdateStoreProfileInput {
  storeName?: string;
  contactPerson?: string;
  businessPhone?: string;
  businessEmail?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

export async function updateStoreProfile(
  userId: string,
  input: UpdateStoreProfileInput,
): Promise<StoreProfileDto> {
  const access = await storeAccess(userId, "settings");
  const store = access.store;
  if (!store.ownerUserId)
    throw new Error("Business owner record is unavailable.");
  const profileData = {
    ...(input.storeName !== undefined && { storeName: input.storeName }),
    ...(input.contactPerson !== undefined && {
      contactPerson: input.contactPerson || null,
    }),
    ...(input.businessPhone !== undefined && {
      businessPhone: input.businessPhone || null,
    }),
    ...(input.businessEmail !== undefined && {
      businessEmail: input.businessEmail || null,
    }),
  };

  // Update Store address/contact fields (slug stays stable after creation)
  const storeData = {
    ...(input.storeName !== undefined && { name: input.storeName }),
    ...(input.contactPerson !== undefined && {
      contactName: input.contactPerson || null,
    }),
    ...(input.businessPhone !== undefined && {
      contactPhone: input.businessPhone || null,
    }),
    ...(input.businessEmail !== undefined && {
      contactEmail: input.businessEmail || null,
    }),
    ...(input.addressLine1 !== undefined && {
      addressLine1: input.addressLine1 || null,
    }),
    ...(input.addressLine2 !== undefined && {
      addressLine2: input.addressLine2 || null,
    }),
    ...(input.city !== undefined && { city: input.city || null }),
    ...(input.province !== undefined && { province: input.province || null }),
    ...(input.postalCode !== undefined && {
      postalCode: input.postalCode || null,
    }),
    ...(input.country !== undefined && { country: input.country }),
  };

  await prisma.$transaction(async (tx) => {
    await tx.storeProfile.upsert({
      where: { userId: store.ownerUserId! },
      create: {
        userId: store.ownerUserId!,
        storeName: input.storeName ?? store.name,
        ...profileData,
      },
      update: profileData,
    });
    await tx.store.update({ where: { id: store.id }, data: storeData });
    if (access.owner && input.contactPerson !== undefined)
      await tx.user.update({
        where: { id: userId },
        data: { name: input.contactPerson || null },
      });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: userId,
        action: "UPDATE",
        entityType: "Store",
        entityId: store.id,
        message: "Business settings updated",
        metadata: {
          fields: Object.keys(input),
          relationship: access.owner ? "OWNER" : "EMPLOYEE",
        },
      },
    });
  });
  return (await getStoreProfile(userId))!;
}
