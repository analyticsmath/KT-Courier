import "server-only";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { UserRole } from "@/types/db";
import { dashboardWindow } from "./dashboard-period";
import { countInsight } from "./count-insight";
import type { DashboardPeriod } from "./types";

export async function getStoreDashboardInsights(period: DashboardPeriod) {
  const user = await requireRole(UserRole.STORE);
  const store = await prisma.store.findFirst({ where: { ownerUserId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!store) return null;
  return countInsight(dashboardWindow(period), "Marketplace order volume", "Marketplace orders by creation date. Courier delivery requests are excluded.", {
    count: (gte, lt) => prisma.marketplaceStoreOrder.count({ where: { storeId: store.id, createdAt: { gte, lt } } }),
    dates: async (gte, lt, take) => (await prisma.marketplaceStoreOrder.findMany({ where: { storeId: store.id, createdAt: { gte, lt } }, select: { createdAt: true }, orderBy: { createdAt: "asc" }, take })).map((row) => row.createdAt),
  });
}
