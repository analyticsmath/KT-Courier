import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import { dashboardWindow } from "@/lib/dashboard-insights/dashboard-period";
import type { DashboardPeriod } from "@/lib/dashboard-insights/types";
import type { AuthenticatedUser } from "@/types/domain";

export type StoreOperationsBucket = "WAITING_FOR_STORE" | "ACCEPTED" | "PACKING" | "OUT_FOR_DELIVERY" |
  "DELIVERED" | "CANCELLED" | "REFUNDED" | "REQUIRES_ACTION";

export function classifyLiveStoreOrder(order: {
  status: string; derivedStatus: string; financialResolutionStatus: string;
}): StoreOperationsBucket {
  if (order.financialResolutionStatus === "REFUND_COMPLETED") return "REFUNDED";
  if (order.status === "CANCELLED" || order.derivedStatus === "REJECTED_OR_CANCELLED") return "CANCELLED";
  if (order.derivedStatus === "DELIVERED") return "DELIVERED";
  if (["IN_TRANSIT", "DELIVERY_ATTEMPTED", "HANDOFF_IN_PROGRESS", "HANDED_OFF_TO_COURIER"].includes(order.derivedStatus)) return "OUT_FOR_DELIVERY";
  if (["PREPARING", "READY_FOR_PICKUP"].includes(order.derivedStatus)) return "PACKING";
  if (order.derivedStatus === "ACCEPTED") return "ACCEPTED";
  if (order.derivedStatus === "AWAITING_STORE_REVIEW") return "WAITING_FOR_STORE";
  return "REQUIRES_ACTION";
}

/** Read-only canonical live-store operations and paid sales; no synthetic metrics. */
export async function getStoreOperationsSnapshot(
  actor: AuthenticatedUser,
  period: DashboardPeriod,
  now = new Date(),
) {
  const [storesAllowed, ordersAllowed] = await Promise.all([
    hasPermission({ userId: actor.id, role: actor.role, permissionKey: "stores.read" }),
    hasPermission({ userId: actor.id, role: actor.role, permissionKey: "orders.read" }),
  ]);
  if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role) || actor.status !== "ACTIVE" || !storesAllowed || !ordersAllowed) {
    throw new Error("Store and order reporting permissions are required.");
  }
  const window = dashboardWindow(period, now);
  const createdAt = { gte: window.start, lte: window.end };
  const [states, failures, topStoresByPaidSales, topItemsByPaidSales, allStores, pendingStores, approvedStores] = await Promise.all([
    prisma.marketplaceStoreOrder.groupBy({
      by: ["status", "derivedStatus", "financialResolutionStatus"],
      where: { operationalScope: "LIVE", createdAt },
      _count: { _all: true },
    }),
    prisma.paymentAttempt.count({
      where: { createdAt, status: "FAILED", payment: { marketplaceCheckoutId: { not: null } } },
    }),
    prisma.marketplaceStoreOrder.groupBy({
      by: ["storeId"],
      where: { operationalScope: "LIVE", createdAt, marketplaceOrder: { payment: { status: "SUCCEEDED" } } },
      _count: { _all: true },
      _sum: { merchandiseSubtotal: true, modifierSubtotal: true },
      orderBy: { _sum: { merchandiseSubtotal: "desc" } },
      take: 10,
    }),
    prisma.marketplaceOrderLine.groupBy({
      by: ["productReference", "title"],
      where: { marketplaceStoreOrder: { operationalScope: "LIVE", marketplaceOrder: { payment: { status: "SUCCEEDED" } }, createdAt } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
    prisma.store.count(),
    prisma.store.count({ where: { status: "PENDING" } }),
    prisma.store.count({ where: { status: "ACTIVE" } }),
  ]);
  const counts: Record<StoreOperationsBucket, number> = {
    WAITING_FOR_STORE: 0, ACCEPTED: 0, PACKING: 0, OUT_FOR_DELIVERY: 0,
    DELIVERED: 0, CANCELLED: 0, REFUNDED: 0, REQUIRES_ACTION: 0,
  };
  for (const row of states) counts[classifyLiveStoreOrder(row)] += row._count._all;
  const names = await prisma.store.findMany({
    where: { id: { in: topStoresByPaidSales.map(row => row.storeId) } },
    select: { id: true, name: true, slug: true },
  });
  const nameById = new Map(names.map(row => [row.id, row]));
  return {
    period, windowLabel: window.label,
    counts, totalStoreOrders: states.reduce((sum, row) => sum + row._count._all, 0),
    failedMarketplacePaymentAttempts: failures,
    accountCounts: { total: allStores, pending: pendingStores, active: approvedStores },
    paidTopStores: topStoresByPaidSales.map(row => ({
      id: row.storeId, name: nameById.get(row.storeId)?.name ?? "Store record unavailable",
      slug: nameById.get(row.storeId)?.slug ?? null,
      paidStoreOrders: row._count._all,
      merchandise: new Prisma.Decimal(row._sum.merchandiseSubtotal ?? 0)
        .add(new Prisma.Decimal(row._sum.modifierSubtotal ?? 0)).toFixed(2),
    })),
    paidTopItems: topItemsByPaidSales.map(row => ({
      reference: row.productReference, title: row.title,
      units: row._sum.quantity ?? 0,
      sales: (row._sum.lineTotal ?? new Prisma.Decimal(0)).toFixed(2),
    })),
    caveats: [
      "Only LIVE operational-scope store orders are counted; legacy imports and simulations are excluded.",
      "Sales rankings use linked SUCCEEDED marketplace payments, not arbitrary cart totals.",
      "Failed marketplace payments count failed provider attempts, not unique customers or completed orders.",
      "No product-review authority is present in the canonical order schema; most-rated products are not fabricated.",
    ],
  };
}
