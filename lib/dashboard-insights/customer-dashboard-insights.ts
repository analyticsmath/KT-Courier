import "server-only";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { UserRole } from "@/types/db";
import { dashboardWindow } from "./dashboard-period";
import { countInsight } from "./count-insight";
import type { DashboardPeriod } from "./types";

export async function getCustomerDashboardInsights(period: DashboardPeriod) {
  const user = await requireRole(UserRole.CUSTOMER);
  const window = dashboardWindow(period);
  return countInsight(window, "Delivery requests", "Requests created in this period. This is activity, not confirmed spend.", {
    count: (gte, lt) => prisma.order.count({ where: { customerId: user.id, createdAt: { gte, lt } } }),
    dates: async (gte, lt, take) => (await prisma.order.findMany({ where: { customerId: user.id, createdAt: { gte, lt } }, select: { createdAt: true }, orderBy: { createdAt: "asc" }, take })).map((row) => row.createdAt),
  });
}
