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

export interface CustomerDashboardBreakdown {
  active: number;
  completed: number;
  attention: number;
  closed: number;
  total: number;
}

/**
 * Server-authoritative distribution of customer deliveries across canonical lifecycle stages.
 * Scoped strictly to authenticated customer; never accepts client-provided identifier.
 */
export async function getCustomerDashboardBreakdown(): Promise<CustomerDashboardBreakdown> {
  const user = await requireRole(UserRole.CUSTOMER);
  const [active, completed, attention, closed] = await Promise.all([
    prisma.order.count({
      where: {
        customerId: user.id,
        status: { in: ["CONFIRMED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "IN_PROGRESS"] },
      },
    }),
    prisma.order.count({
      where: {
        customerId: user.id,
        status: { in: ["DELIVERED", "COMPLETED"] },
      },
    }),
    prisma.order.count({
      where: {
        customerId: user.id,
        status: { in: ["PENDING", "DELIVERY_ATTEMPTED"] },
      },
    }),
    prisma.order.count({
      where: {
        customerId: user.id,
        status: { in: ["CANCELLED", "FAILED", "DRAFT"] },
      },
    }),
  ]);

  return {
    active,
    completed,
    attention,
    closed,
    total: active + completed + attention + closed,
  };
}
