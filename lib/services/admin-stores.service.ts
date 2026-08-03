import { prisma } from "@/lib/db/prisma";
import {
  toAdminStoreListItem,
  type AdminStoreListItem,
} from "@/lib/dto/user.dto";
import type { StoreStatus } from "@/types/db";

// ─── List ─────────────────────────────────────────────────────────────────────

export interface AdminStoreListOptions {
  status?: StoreStatus;
  featured?: boolean;
  search?: string;
  page: number;
  pageSize: number;
}

export interface AdminStoreListResult {
  data: AdminStoreListItem[];
  total: number;
}

export async function listStores(
  opts: AdminStoreListOptions
): Promise<AdminStoreListResult> {
  const { status, featured, search, page, pageSize } = opts;
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
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { ownerUser: true },
    }),
    prisma.store.count({ where }),
  ]);

  return { data: stores.map(toAdminStoreListItem), total };
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getStoreDetail(id: string) {
  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      ownerUser: {
        include: { storeProfile: true },
      },
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
    ownerUser: store.ownerUser
      ? {
          id: store.ownerUser.id,
          email: store.ownerUser.email,
          name: store.ownerUser.name,
          phone: store.ownerUser.phone,
          status: store.ownerUser.status,
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
  status?: StoreStatus;
  featured?: boolean;
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
      ...(input.status !== undefined && { status: input.status }),
      ...(input.featured !== undefined && { featured: input.featured }),
    },
  });
}

export async function setStoreStatus(id: string, status: StoreStatus) {
  return prisma.store.update({ where: { id }, data: { status } });
}

export async function setStoreFeatured(id: string, featured: boolean) {
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
