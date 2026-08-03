import { prisma } from "@/lib/db/prisma";
import { countLegacyFailedEmailHistory } from "@/lib/notifications/legacy-email-history";
import { UserRole, UserStatus, StoreStatus, OrderStatus, ContactMessageStatus } from "@/types/db";
import { toAdminStoreListItem, type AdminStoreListItem } from "@/lib/dto/user.dto";
import { toOrderSummaryDto, type OrderSummaryDto } from "@/lib/dto/order.dto";
import { toContactMessageSummaryDto, type ContactMessageSummaryDto } from "@/lib/dto/contact.dto";
import { toAdminActivityDto, type AdminActivityDto } from "@/lib/dto/admin-activity.dto";

// ─── Stats shape ──────────────────────────────────────────────────────────────

export interface AdminDashboardStats {
  totalUsers: number;
  customersCount: number;
  storesCount: number;
  totalStores: number;
  pendingStores: number;
  activeStores: number;
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  failedOrders: number;
  contactMessagesNew: number;
  pricingRulesActive: number;
  emailLogsFailed: number;
  // Route coverage KPIs (Phase 2.2)
  ordersWithRoute: number;
  ordersWithoutRoute: number;
  activeDeliveryRegions: number;
  averageRouteDistanceMeters: number | null;
}

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  recentOrders: OrderSummaryDto[];
  recentStores: AdminStoreListItem[];
  recentContactMessages: ContactMessageSummaryDto[];
  recentAdminActivity: AdminActivityDto[];
  activeRegionSummaries: Array<{
    id: string;
    name: string;
    city: string | null;
    province: string | null;
    coverageRadiusKm: number | null;
    maxDistanceKm: number | null;
  }>;
  ordersNeedingAttention: OrderSummaryDto[];
}

// ─── Fetch all dashboard data ─────────────────────────────────────────────────

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    totalUsers,
    customersCount,
    storesCount,
    totalStores,
    pendingStores,
    activeStores,
    totalOrders,
    pendingOrders,
    confirmedOrders,
    inProgressOrders,
    completedOrders,
    cancelledOrders,
    failedOrders,
    contactMessagesNew,
    pricingRulesActive,
    emailLogsFailed,
    ordersWithRoute,
    activeDeliveryRegions,
    averageRouteDistance,
    recentOrdersRaw,
    recentStoresRaw,
    recentContactRaw,
    recentActivityRaw,
    activeRegionsRaw,
    attentionOrdersRaw,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: UserStatus.DISABLED } } }),
    prisma.user.count({ where: { role: UserRole.CUSTOMER, status: { not: UserStatus.DISABLED } } }),
    prisma.user.count({ where: { role: UserRole.STORE, status: { not: UserStatus.DISABLED } } }),
    prisma.store.count(),
    prisma.store.count({ where: { status: StoreStatus.PENDING } }),
    prisma.store.count({ where: { status: StoreStatus.ACTIVE } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: OrderStatus.PENDING } }),
    prisma.order.count({ where: { status: OrderStatus.CONFIRMED } }),
    prisma.order.count({
      where: {
        status: {
          in: [
            OrderStatus.IN_PROGRESS,
            OrderStatus.PICKUP_SCHEDULED,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT,
            OrderStatus.DELIVERY_ATTEMPTED,
          ],
        },
      },
    }),
    prisma.order.count({ where: { status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] } } }),
    prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
    prisma.order.count({ where: { status: OrderStatus.FAILED } }),
    prisma.contactMessage.count({ where: { status: ContactMessageStatus.NEW } }),
    prisma.pricingRule.count({ where: { active: true } }),
    countLegacyFailedEmailHistory(),
    // Route coverage KPIs
    prisma.order.count({ where: { distanceMeters: { not: null } } }),
    prisma.deliveryRegion.count({ where: { active: true } }),
    prisma.order.aggregate({
      where: { distanceMeters: { not: null } },
      _avg: { distanceMeters: true },
    }),
    // Recent orders (last 5)
    prisma.order.findMany({
      include: {
        pickupAddress: true,
        dropoffAddress: true,
        deliveryRegion: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.store.findMany({
      include: { ownerUser: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.adminActivityLog.findMany({
      include: { actorUser: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.deliveryRegion.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        city: true,
        province: true,
        coverageRadiusKm: true,
        maxDistanceKm: true,
      },
      orderBy: [{ displayOrder: "asc" }, { updatedAt: "desc" }],
      take: 5,
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { status: { in: [OrderStatus.PENDING, OrderStatus.DELIVERY_ATTEMPTED, OrderStatus.FAILED] } },
          {
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.PICKUP_SCHEDULED,
                OrderStatus.PICKED_UP,
                OrderStatus.IN_TRANSIT,
                OrderStatus.DELIVERY_ATTEMPTED,
              ],
            },
            distanceMeters: null,
          },
        ],
      },
      include: {
        pickupAddress: true,
        dropoffAddress: true,
        deliveryRegion: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  return {
    stats: {
      totalUsers,
      customersCount,
      storesCount,
      totalStores,
      pendingStores,
      activeStores,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      inProgressOrders,
      completedOrders,
      cancelledOrders,
      failedOrders,
      contactMessagesNew,
      pricingRulesActive,
      emailLogsFailed,
      ordersWithRoute,
      ordersWithoutRoute: totalOrders - ordersWithRoute,
      activeDeliveryRegions,
      averageRouteDistanceMeters: averageRouteDistance._avg.distanceMeters
        ? Math.round(averageRouteDistance._avg.distanceMeters)
        : null,
    },
    recentOrders: recentOrdersRaw.map(toOrderSummaryDto),
    recentStores: recentStoresRaw.map(toAdminStoreListItem),
    recentContactMessages: recentContactRaw.map(toContactMessageSummaryDto),
    recentAdminActivity: recentActivityRaw.map(toAdminActivityDto),
    activeRegionSummaries: activeRegionsRaw.map((region) => ({
      id: region.id,
      name: region.name,
      city: region.city,
      province: region.province,
      coverageRadiusKm: region.coverageRadiusKm !== null ? Number(region.coverageRadiusKm) : null,
      maxDistanceKm: region.maxDistanceKm !== null ? Number(region.maxDistanceKm) : null,
    })),
    ordersNeedingAttention: attentionOrdersRaw.map(toOrderSummaryDto),
  };
}
