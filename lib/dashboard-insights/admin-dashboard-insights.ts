import "server-only";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { dashboardWindow } from "./dashboard-period";
import { countInsight } from "./count-insight";
import type { DashboardPeriod } from "./types";

export async function getAdminDashboardInsights(period: DashboardPeriod) {
  await requireAdminPagePermission(PERMISSIONS.ADMIN_DASHBOARD_READ);
  await requireAdminPagePermission(PERMISSIONS.ORDERS_READ);
  return countInsight(dashboardWindow(period), "Courier order volume", "Courier orders by creation date across the network. Marketplace orders are excluded.", {
    count: (gte, lt) => prisma.order.count({ where: { createdAt: { gte, lt } } }),
    dates: async (gte, lt, take) => (await prisma.order.findMany({ where: { createdAt: { gte, lt } }, select: { createdAt: true }, orderBy: { createdAt: "asc" }, take })).map((row) => row.createdAt),
  });
}
