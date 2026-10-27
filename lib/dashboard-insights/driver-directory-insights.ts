import "server-only";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";

export async function getDriverDirectoryInsights() {
  await requireAdminPagePermission(PERMISSIONS.DRIVERS_READ);
  const [status, availability] = await Promise.all([
    prisma.driverProfile.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.driverProfile.groupBy({
      by: ["availability"],
      _count: { _all: true },
    }),
  ]);
  return {
    status,
    availability,
    total: status.reduce((n, row) => n + row._count._all, 0),
  };
}
