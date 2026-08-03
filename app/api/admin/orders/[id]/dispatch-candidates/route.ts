import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { listEligibleDrivers } from "@/lib/services/driver-eligibility.service";
import { rankDispatchCandidates } from "@/lib/dispatch/candidate-ranking";
import { notFound, ok, serverError } from "@/lib/api/response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_READ);
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const order = await prisma.order.findUnique({ where: { id }, select: { deliveryRegionId: true } });
    if (!order) return notFound("Order not found.");
    const result = await listEligibleDrivers(order.deliveryRegionId);
    const all = [...result.recommended, ...result.available, ...result.regionMismatch, ...result.unavailable, ...result.notEligible];
    const rank = rankDispatchCandidates(all.map((driver) => ({ id: driver.id, driverCode: driver.driverCode, eligible: ["RECOMMENDED", "AVAILABLE"].includes(driver.eligibility), regionMatch: driver.regionMatch, vehicleMatch: true, activeLoad: driver.activeAssignmentCount, capacity: 1, availabilityUpdatedAt: null })));
    const byId = new Map(all.map((driver) => [driver.id, driver]));
    return ok(rank.map((item, index) => ({ rank: index + 1, ...byId.get(item.id), eligible: item.eligible, ranking: [item.regionMatch ? "REGION_MATCH" : "REGION_MISMATCH", `LOAD_${item.activeLoad}_OF_${item.capacity}`] })));
  } catch {
    return serverError();
  }
}
