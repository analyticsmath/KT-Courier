import "server-only";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { UserRole } from "@/types/db";
import { dashboardWindow } from "./dashboard-period";
import { countInsight } from "./count-insight";
import type { DashboardPeriod } from "./types";

export async function getDriverDashboardInsights(period: DashboardPeriod) {
  const user = await requireRole(UserRole.DRIVER);
  const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!driver) return null;
  return countInsight(dashboardWindow(period), "Completed assignments", "Assignments recorded as completed, grouped by their completion time.", {
    count: (gte, lt) => prisma.orderAssignment.count({ where: { driverProfileId: driver.id, status: "COMPLETED", completedAt: { gte, lt } } }),
    dates: async (gte, lt, take) => (await prisma.orderAssignment.findMany({ where: { driverProfileId: driver.id, status: "COMPLETED", completedAt: { gte, lt } }, select: { completedAt: true }, orderBy: { completedAt: "asc" }, take })).flatMap((row) => row.completedAt ? [row.completedAt] : []),
  });
}
